import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { getProviderSecret } from '@/server/provider-secrets';
import { consumeRateLimit } from '@/server/rate-limit';
import { resolveFeatureRoute } from '@/server/feature-routing';
import { analyzeImageWithGoogle } from '@/core/providers/google';
import { createMediaPreview } from '@/lib/media/preview';
import { compressImageForStorage, MAX_STORAGE_IMAGE_BYTES } from '@/lib/media/compressed-image';
import { canUseImageAnalysis, imageAnalysisCredits, type ImageAnalysisLevel } from '@/config/media-features';

export const runtime = 'nodejs';

const levels = new Set<ImageAnalysisLevel>(['basic', 'medium', 'hard']);
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff']);
const maxBytes = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let admin: ReturnType<typeof getSupabaseAdmin> | null = null;
  let reserved = false;
  let finalized = false;
  let userId = '';
  let credits = 0;
  let idempotencyKey = '';
  let jobId = '';
  const storagePaths: string[] = [];

  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = user.id;

    const rate = await consumeRateLimit(`user:${user.id}:image-analysis`, 12, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Image analysis rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

    const form = await request.formData();
    const file = form.get('image');
    const level = String(form.get('level') ?? 'basic') as ImageAnalysisLevel;
    if (!(file instanceof File) || !levels.has(level)) return NextResponse.json({ error: 'Image and valid analysis level are required' }, { status: 400 });
    if (!imageTypes.has(file.type)) return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    if (file.size <= 0 || file.size > maxBytes) return NextResponse.json({ error: 'Image is empty or exceeds the 25 MB analysis limit' }, { status: 413 });

    admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan_id').eq('id', user.id).single();
    if (profileError || !profile || !['free', 'pro', 'business'].includes(profile.plan_id)) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });
    const plan = profile.plan_id as 'free' | 'pro' | 'business';
    if (!canUseImageAnalysis(plan, level)) return NextResponse.json({ error: `${level} image analysis is not available on the ${plan} plan` }, { status: 403 });

    const route = await resolveFeatureRoute(plan, 'image_analysis', level === 'basic' ? 'basic' : level === 'medium' ? 'medium' : 'hard');
    if (route.provider !== 'google' || route.protocol !== 'google_gemini') throw new Error('Image analysis must use the configured Google provider');
    const apiKey = await getProviderSecret(route.provider, route.secretEnv);

    const sourceBytes = Buffer.from(await file.arrayBuffer());
    const stored = await compressImageForStorage(sourceBytes, { maxBytes: MAX_STORAGE_IMAGE_BYTES });
    const storedBytes = stored.buffer;
    const sha256 = createHash('sha256').update(storedBytes).digest('hex');
    const id = randomUUID();
    jobId = id;
    idempotencyKey = `image-analysis:${id}`;
    credits = imageAnalysisCredits(plan, level);

    const { data: reservedCredits, error: reserveError } = await admin.rpc('reserve_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
    if (reserveError) throw new Error(`Credit reservation failed: ${reserveError.message}`);
    if (!reservedCredits) return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    reserved = true;

    const started = Date.now();
    const analysis = await analyzeImageWithGoogle({ base64: storedBytes.toString('base64'), mimeType: stored.mimeType, level, apiKey, model: route.model });

    const metadata = await sharp(storedBytes, { animated: false }).metadata();
    const width = metadata.width ?? stored.width;
    const height = metadata.height ?? stored.height;
    const preview = await createMediaPreview(storedBytes);
    const storagePath = `${user.id}/analysis/${id}/master.webp`;
    const previewPath = `${user.id}/analysis/${id}/preview.webp`;
    storagePaths.push(storagePath, previewPath);

    const { error: storedUploadError } = await admin.storage.from('solamentis-assets').upload(storagePath, storedBytes, { contentType: stored.mimeType, cacheControl: '31536000, immutable', upsert: false });
    if (storedUploadError) throw new Error(`Compressed analysis image storage failed: ${storedUploadError.message}`);
    const { error: previewUploadError } = await admin.storage.from('solamentis-assets').upload(previewPath, preview.buffer, { contentType: preview.mimeType, cacheControl: '31536000, immutable', upsert: false });
    if (previewUploadError) throw new Error(`Preview image storage failed: ${previewUploadError.message}`);

    const analysisJobRequest = {
      plan, operation: 'analyzeImage', analysisLevel: level, analysisProvider: analysis.provider, analysisModel: analysis.model,
      analysisResult: analysis.result, imageSha256: sha256, inputMimeType: file.type, inputByteSize: sourceBytes.byteLength,
      storedMimeType: stored.mimeType, storedByteSize: stored.byteSize, storedStoragePath: storagePath,
      previewMimeType: preview.mimeType, previewByteSize: preview.byteSize, previewStoragePath: previewPath,
      width, height, previewWidth: preview.width ?? width, previewHeight: preview.height ?? height,
      storedMaxWidth: 1920, storedQuality: stored.quality, previewMaxWidth: 640, previewQuality: 60,
      latencyMs: Date.now() - started, safetyApplied: false, storageRole: 'compressed_master + compressed_preview',
    };

    const { data: job, error: jobError } = await admin.from('generation_jobs').insert({
      id, user_id: user.id, status: 'processing', operation: 'analyzeImage', prompt: `Image authenticity analysis · ${level}`,
      size: width && height ? `${width}x${height}` : `${stored.byteSize} bytes`, quality: 'preview', provider: analysis.provider, model: analysis.model,
      reserved_credits: credits, idempotency_key: idempotencyKey, started_at: new Date(started).toISOString(), request: analysisJobRequest,
    }).select('id').single();
    if (jobError || !job) throw new Error(jobError?.message ?? 'Unable to save analysis history');

    const assetRows = [
      { user_id: user.id, kind: 'upload', storage_path: storagePath, mime_type: stored.mimeType, byte_size: stored.byteSize, width, height, checksum: sha256, status: 'ready', metadata: { job_id: id, role: 'analysis_compressed_master', storage_variant: 'compressed_master', analysis_level: level, source_input_byte_size: sourceBytes.byteLength, preview_storage_path: previewPath, preview_byte_size: preview.byteSize } },
      { user_id: user.id, kind: 'preview', storage_path: previewPath, mime_type: preview.mimeType, byte_size: preview.byteSize, width: preview.width, height: preview.height, checksum: createHash('sha256').update(preview.buffer).digest('hex'), status: 'ready', metadata: { job_id: id, role: 'analysis_preview', storage_variant: 'preview', source_storage_path: storagePath, source_byte_size: stored.byteSize } },
    ];
    const { data: assets, error: assetsError } = await admin.from('assets').insert(assetRows).select('id,storage_path,mime_type,byte_size,width,height');
    if (assetsError || !assets || assets.length !== 2) throw new Error(assetsError?.message ?? 'Unable to save analysis assets');
    const masterAsset = assets.find(asset => asset.storage_path === storagePath);
    const previewAsset = assets.find(asset => asset.storage_path === previewPath);
    if (!masterAsset || !previewAsset) throw new Error('Saved analysis assets are unavailable');

    const { error: outputError } = await admin.from('generation_outputs').insert([
      { job_id: id, asset_id: masterAsset.id, variant: 'master', storage_path: storagePath, mime_type: stored.mimeType, width, height, byte_size: stored.byteSize },
      { job_id: id, asset_id: previewAsset.id, variant: 'preview', storage_path: previewPath, mime_type: preview.mimeType, width: preview.width, height: preview.height, byte_size: preview.byteSize },
    ]);
    if (outputError) throw new Error(`Unable to save analysis outputs: ${outputError.message}`);

    const { error: finalizeError } = await admin.rpc('finalize_generation_credits', { p_user_id: user.id, p_amount: credits, p_idempotency_key: idempotencyKey });
    if (finalizeError) throw new Error(`Credit finalization failed: ${finalizeError.message}`);
    finalized = true;

    const completedAt = new Date().toISOString();
    const { error: completeError } = await admin.from('generation_jobs').update({ status: 'succeeded', reserved_credits: 0, completed_at: completedAt, request: analysisJobRequest }).eq('id', id).eq('user_id', user.id);
    if (completeError) throw new Error(`Analysis history completion failed: ${completeError.message}`);

    const [{ data: masterUrl }, { data: previewUrl }] = await Promise.all([
      admin.storage.from('solamentis-assets').createSignedUrl(storagePath, 3600),
      admin.storage.from('solamentis-assets').createSignedUrl(previewPath, 3600),
    ]);

    return NextResponse.json({
      jobId: id, provider: analysis.provider, model: analysis.model, level, credits, imageSha256: sha256, safetyApplied: false, result: analysis.result,
      output: { variant: 'master', storage_path: storagePath, mime_type: stored.mimeType, width, height, byte_size: stored.byteSize, url: masterUrl?.signedUrl ?? null },
      preview: { variant: 'preview', storage_path: previewPath, mime_type: preview.mimeType, width: preview.width ?? width, height: preview.height ?? height, byte_size: preview.byteSize, url: previewUrl?.signedUrl ?? null },
    });
  } catch (error) {
    if (admin && storagePaths.length) {
      try { await admin.storage.from('solamentis-assets').remove(storagePaths); } catch { /* cleanup is best-effort */ }
    }
    if (admin && jobId) {
      try { await admin.from('generation_outputs').delete().eq('job_id', jobId); } catch { /* cleanup is best-effort */ }
      try { await admin.from('assets').delete().eq('user_id', userId).eq('metadata->>job_id', jobId); } catch { /* cleanup is best-effort */ }
      try { await admin.from('generation_jobs').delete().eq('id', jobId).eq('user_id', userId); } catch { /* cleanup is best-effort */ }
    }
    if (admin && reserved && !finalized) {
      try { await admin.rpc('refund_generation_credits', { p_user_id: userId, p_amount: credits, p_idempotency_key: `${idempotencyKey}:refund` }); } catch { /* credit recovery is best-effort */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Image analysis failed' }, { status: 400 });
  }
}
