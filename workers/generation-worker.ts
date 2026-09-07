import { getProviderAdapter } from '@/core/provider-registry';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { getProviderSecret } from '@/server/provider-secrets';
import { resolveFeatureRoute } from '@/server/feature-routing';
import { moderateImage } from '@/server/image-moderation';
import { optimizeImage } from '@/lib/image/optimizer';
import { createMediaPreview } from '@/lib/media/preview';
import { applyWatermark } from '@/lib/image/watermark';
import { buildProvenance, embedProvenance, type ProvenanceRecord } from '@/lib/image/provenance';
import type { ProviderResult, ReferenceImage } from '@/core/ai';
import { processVideoAdJob } from './video-ad-worker';

interface QueueMessage { job_id: string }
const MAX_ATTEMPTS = 3;

function isRetryableProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  if (message.includes('aborted') || message.includes('timeout') || message.includes('timed out')) return true;
  const status = message.match(/\bhttp\s+(429|500|502|503|504)\b/);
  return Boolean(status);
}

async function markProviderHealth(providerId: string, ok: boolean, latencyMs?: number, message?: string) {
  const admin = getSupabaseAdmin();
  const { data: provider } = await admin.from('ai_providers').select('health_failures').eq('id', providerId).maybeSingle();
  const failures = ok ? 0 : Number(provider?.health_failures ?? 0) + 1;
  await admin.from('ai_providers').update({ health_status: ok ? 'healthy' : 'degraded', health_checked_at: new Date().toISOString(), health_latency_ms: latencyMs ?? null, health_message: message ?? null, health_failures: failures }).eq('id', providerId);
  await admin.from('provider_health_events').insert({ provider_id: providerId, ok, latency_ms: latencyMs ?? null, message: message ?? null, capabilities: { image_generation: true } });
}

async function resolveProjectName(userId: string, projectId?: string | null) {
  const admin = getSupabaseAdmin();
  if (projectId) {
    const { data } = await admin.from('projects').select('name').eq('id', projectId).eq('user_id', userId).maybeSingle();
    const projectName = data?.name?.trim();
    if (projectName) return projectName;
  }
  return 'SOLAMENTIS';
}

function inferMimeType(path: string) {
  const normalized = path.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/webp';
}

async function loadReferenceImages(request: Record<string, unknown>): Promise<ReferenceImage[]> {
  const admin = getSupabaseAdmin();
  const paths = Array.isArray(request.referenceImageStoragePaths) ? request.referenceImageStoragePaths.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
  const direct = Array.isArray(request.referenceImages) ? request.referenceImages.filter((value): value is ReferenceImage => Boolean(value && typeof value === 'object' && 'base64' in value && 'mimeType' in value)) : [];
  if (!paths.length) return direct;
  const images: ReferenceImage[] = [];
  for (const path of paths) {
    const { data, error } = await admin.storage.from('solamentis-assets').download(path);
    if (error || !data) throw new Error(`Reference image unavailable: ${error?.message ?? 'download failed'}`);
    images.push({ mimeType: inferMimeType(path), base64: Buffer.from(await data.arrayBuffer()).toString('base64') });
  }
  return images;
}

export async function processGenerationJob(jobId: string) {
  const admin = getSupabaseAdmin();
  const { data: job, error: loadError } = await admin.from('generation_jobs').select('*').eq('id', jobId).single();
  if (loadError || !job) throw new Error(`Job not found: ${jobId}`);
  if (job.status === 'succeeded' || job.status === 'cancelled') return job;
  if (job.status !== 'queued') return job;

  const { data: claimed, error: claimError } = await admin.from('generation_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'queued').select('id');
  if (claimError) throw new Error(`Unable to claim job: ${claimError.message}`);
  if (!claimed?.length) return job;

  let creditsFinalized = false;
  try {
    if (job.operation === 'generateVideoAd') return await processVideoAdJob({ ...job, status: 'processing' });
    if (job.operation !== 'generateImage') throw new Error(`Unsupported generation operation: ${job.operation}`);

    const request = job.request as Record<string, unknown>;
    const planId = String(request.plan ?? 'free');
    const category = request.category === 'text_graphic' ? 'text_graphic' : 'social_image';
    const quality = job.quality === 'premium' ? 'ultra' : job.quality === 'standard' ? 'medium' : 'basic';
    const route = await resolveFeatureRoute(planId, category, quality);
    if (route.provider !== job.provider || route.model !== job.model) throw new Error(`Job route changed after enqueue; refusing stale provider/model ${job.provider}/${job.model}`);

    let result: ProviderResult | null = null;
    let actualProvider = route.provider;
    let actualModel = route.model;
    let lastProviderError: unknown = null;
    const referenceImages = await loadReferenceImages(request);

    try {
      const adapter = getProviderAdapter(route);
      const apiKey = await getProviderSecret(route.provider, route.secretEnv);
      const started = Date.now();
      const generated = await adapter.generate({
        userId: job.user_id,
        plan: planId as 'free' | 'pro' | 'business',
        operation: 'generateImage',
        category,
        prompt: job.prompt,
        size: job.size,
        width: Number(request.width ?? 1024),
        height: Number(request.height ?? 1024),
        quality: job.quality as 'preview' | 'standard' | 'premium',
        referenceImages,
        model: route.model,
        apiKey,
      });
      await markProviderHealth(route.provider, true, Date.now() - started);
      result = generated;
    } catch (providerError) {
      lastProviderError = providerError;
      if (isRetryableProviderError(providerError)) await markProviderHealth(route.provider, false, undefined, providerError instanceof Error ? providerError.message : 'provider generation failed');
    }

    if (!result) throw lastProviderError instanceof Error ? lastProviderError : new Error('Configured image provider failed');

    const outputBufferBeforeModeration = Buffer.from(result.base64, 'base64');
    const moderation = await moderateImage({ mimeType: result.mimeType || 'image/png', base64: result.base64, userId: job.user_id, jobId: job.id, stage: 'generation' });
    if (moderation.decision !== 'allow') {
      const safetyCode = moderation.decision === 'block' ? 'SAFETY_BLOCKED' : 'SAFETY_REVIEW_REQUIRED';
      await admin.from('generation_jobs').update({ status: 'failed', error_code: safetyCode, error_message: moderation.reasons.length ? moderation.reasons.join('; ') : 'Generated image did not pass post-generation safety policy', completed_at: new Date().toISOString(), request: { ...(request ?? {}), actualProvider, actualModel, moderationDecision: moderation.decision } }).eq('id', job.id);
      if (job.reserved_credits > 0) {
        const { error: refundError } = await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: `${job.idempotency_key}:${safetyCode.toLowerCase()}` });
        if (refundError) throw new Error(`Safety refund failed: ${refundError.message}`);
      }
      return await admin.from('generation_jobs').select('*').eq('id', job.id).single().then(({ data }) => data ?? job);
    }

    let outputBuffer = outputBufferBeforeModeration;
    const watermarkText = Boolean(request.watermark) ? await resolveProjectName(job.user_id, job.project_id) : null;
    if (watermarkText) outputBuffer = await applyWatermark(outputBuffer, watermarkText);

    let image = await optimizeImage(outputBuffer, {
      width: Number(request.width ?? 1024),
      height: Number(request.height ?? 1024),
      maxBytes: Number(request.maxExportBytes ?? 8_000_000),
    });

    let provenance: ProvenanceRecord | null = null;
    if (planId !== 'free') {
      provenance = buildProvenance({ site: 'Solamentis', projectName: await resolveProjectName(job.user_id, job.project_id), jobId: job.id, provider: actualProvider, model: actualModel, createdAt: new Date().toISOString() });
      const buffer = await embedProvenance(image.buffer, provenance);
      image = { ...image, buffer, byteSize: buffer.byteLength };
    }

    const preview = await createMediaPreview(image.buffer);
    const base = `${job.user_id}/jobs/${job.id}`;
    const masterPath = `${base}/master.webp`;
    const previewPath = `${base}/preview.webp`;
    const { error: masterUploadError } = await admin.storage.from('solamentis-assets').upload(masterPath, image.buffer, { contentType: image.mimeType, upsert: true, cacheControl: '31536000, immutable' });
    if (masterUploadError) throw new Error(`Storage upload failed: ${masterUploadError.message}`);
    const { error: previewUploadError } = await admin.storage.from('solamentis-assets').upload(previewPath, preview.buffer, { contentType: preview.mimeType, upsert: true, cacheControl: '31536000, immutable' });
    if (previewUploadError) throw new Error(`Preview storage upload failed: ${previewUploadError.message}`);

    const { data: masterAsset, error: masterAssetError } = await admin.from('assets').insert({ user_id: job.user_id, project_id: job.project_id ?? null, kind: 'generated', storage_path: masterPath, mime_type: image.mimeType, byte_size: image.byteSize, width: image.width, height: image.height, status: 'ready', metadata: { job_id: job.id, provider: actualProvider, model: actualModel, primary_provider: job.provider, primary_model: job.model, external_id: result.externalId, moderation_decision: moderation.decision, moderation_provider: moderation.provider, moderation_model: moderation.model, moderation_reasons: moderation.reasons, watermark_text: watermarkText, provenance, storage_variant: 'master', preview_storage_path: previewPath, preview_byte_size: preview.byteSize } }).select('id').single();
    if (masterAssetError || !masterAsset) throw new Error(masterAssetError?.message ?? 'Failed to persist generated asset');

    const { data: previewAsset, error: previewAssetError } = await admin.from('assets').insert({ user_id: job.user_id, project_id: job.project_id ?? null, kind: 'preview', storage_path: previewPath, mime_type: preview.mimeType, byte_size: preview.byteSize, width: preview.width, height: preview.height, status: 'ready', metadata: { job_id: job.id, role: 'generated_preview', storage_variant: 'preview', source_storage_path: masterPath, source_byte_size: image.byteSize } }).select('id').single();
    if (previewAssetError || !previewAsset) throw new Error(previewAssetError?.message ?? 'Failed to persist generated preview asset');

    const { error: outputsError } = await admin.from('generation_outputs').upsert([
      { job_id: job.id, asset_id: masterAsset.id, variant: 'master', storage_path: masterPath, mime_type: image.mimeType, width: image.width, height: image.height, byte_size: image.byteSize },
      { job_id: job.id, asset_id: previewAsset.id, variant: 'preview', storage_path: previewPath, mime_type: preview.mimeType, width: preview.width, height: preview.height, byte_size: preview.byteSize },
    ], { onConflict: 'job_id,variant' });
    if (outputsError) throw new Error(`Failed to persist output: ${outputsError.message}`);

    const { error: finalizeError } = await admin.rpc('finalize_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: job.idempotency_key });
    if (finalizeError) throw new Error(`Credit finalization failed: ${finalizeError.message}`);
    creditsFinalized = true;
    const { data: completed, error: completeError } = await admin.from('generation_jobs').update({ status: 'succeeded', output_path: masterPath, external_job_id: result.externalId, completed_at: new Date().toISOString(), request: { ...(request ?? {}), actualProvider, actualModel, moderationDecision: moderation.decision, masterByteSize: image.byteSize, previewByteSize: preview.byteSize, masterStoragePath: masterPath, previewStoragePath: previewPath } }).eq('id', job.id).select('*').single();
    if (completeError) throw new Error(`Job completion failed: ${completeError.message}`);
    return completed ?? job;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation worker failed';
    const currentAttempts = Number((job.request as Record<string, unknown>)?.attempts ?? 0) + 1;
    await admin.from('job_failures').insert({ job_id: job.id, attempt: currentAttempts, error_code: 'GENERATION_ATTEMPT_FAILED', error_message: message, provider_id: job.provider, model_key: job.model });
    if (creditsFinalized || currentAttempts >= MAX_ATTEMPTS) {
      if (!creditsFinalized && currentAttempts >= MAX_ATTEMPTS) await admin.rpc('refund_generation_credits', { p_user_id: job.user_id, p_amount: job.reserved_credits, p_idempotency_key: `${job.idempotency_key}:terminal_refund` });
      await admin.from('generation_jobs').update({ status: 'failed', error_code: 'GENERATION_FAILED', error_message: message, completed_at: new Date().toISOString(), request: { ...(job.request ?? {}), attempts: currentAttempts, last_error: message } }).eq('id', job.id);
      return await admin.from('generation_jobs').select('*').eq('id', job.id).single().then(({ data }) => data ?? job);
    }
    await admin.from('generation_jobs').update({ status: 'queued', error_code: 'RETRY_PENDING', error_message: message, request: { ...(job.request ?? {}), attempts: currentAttempts, last_error: message } }).eq('id', job.id);
    return job;
  }
}

export async function processGenerationQueue(batchSize = 5) {
  const admin = getSupabaseAdmin();
  const { data: messages, error } = await admin.rpc('claim_generation_messages', { p_visibility_seconds: 600, p_quantity: batchSize });
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  let processed = 0;
  for (const message of (messages ?? []) as Array<{ msg_id: number; message: QueueMessage }>) {
    processed += 1;
    try {
      const job = await processGenerationJob(message.message.job_id);
      if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') await admin.rpc('delete_generation_message', { p_msg_id: message.msg_id });
    } catch (error) {
      const { data: job } = await admin.from('generation_jobs').select('status').eq('id', message.message.job_id).maybeSingle();
      if (job?.status === 'failed') await admin.rpc('delete_generation_message', { p_msg_id: message.msg_id });
      console.error('Generation job failed', message.message.job_id, error);
    }
  }
  return processed;
}
