import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { moderateImage } from '@/server/image-moderation';
import { createMediaPreview } from '@/lib/media/preview';

export const runtime = 'nodejs';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;

export async function POST(request: Request) {
  const cleanupPaths: string[] = [];
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await consumeRateLimit(`user:${user.id}:upload-complete`, 30, 60);
    if (!rate.allowed) return NextResponse.json(
      { error: 'Upload finalization rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );

    const body = await request.json() as { assetId?: string };
    if (!body.assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: asset, error: assetError } = await admin.from('assets').select('*').eq('id', body.assetId).eq('user_id', user.id).single();
    if (assetError || !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.kind !== 'upload' || asset.status !== 'uploading') return NextResponse.json({ error: 'Asset is not awaiting upload completion' }, { status: 409 });

    const { data: blob, error: downloadError } = await admin.storage.from('solamentis-assets').download(asset.storage_path);
    if (downloadError || !blob) return NextResponse.json({ error: 'Uploaded file could not be read' }, { status: 422 });

    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.byteLength <= 0 || buffer.byteLength > MAX_BYTES) return NextResponse.json({ error: 'Uploaded file exceeds size limits' }, { status: 422 });

    const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) return NextResponse.json({ error: 'Invalid image file' }, { status: 422 });
    if (metadata.width * metadata.height > MAX_PIXELS) return NextResponse.json({ error: 'Image dimensions exceed processing limits' }, { status: 422 });

    const formatMap = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
    if (!(metadata.format in formatMap)) return NextResponse.json({ error: 'Unsupported image format' }, { status: 422 });
    const mimeType = formatMap[metadata.format as keyof typeof formatMap];
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const declaredSize = Number((asset.metadata as Record<string, unknown> | null)?.declared_byte_size ?? asset.byte_size);

    const moderation = await moderateImage({
      mimeType,
      base64: buffer.toString('base64'),
      userId: user.id,
      assetId: asset.id,
      stage: 'upload',
    });
    const status = moderation.decision === 'allow' ? 'ready' : moderation.decision === 'review' ? 'review' : 'blocked';

    const uploadPreview = status === 'ready' ? await createMediaPreview(buffer) : null;
    const previewPath = `${asset.storage_path}.preview.webp`;
    if (uploadPreview) cleanupPaths.push(previewPath);

    const { data: updated, error: updateError } = await admin.from('assets').update({
      status,
      byte_size: buffer.byteLength,
      width: metadata.width,
      height: metadata.height,
      mime_type: mimeType,
      checksum,
      metadata: {
        ...(asset.metadata ?? {}),
        validated_at: new Date().toISOString(),
        declared_size_matches: declaredSize === buffer.byteLength,
        moderation_decision: moderation.decision,
        moderation_provider: moderation.provider,
        moderation_model: moderation.model,
        storage_variant: 'master',
        preview_storage_path: uploadPreview ? previewPath : null,
        preview_byte_size: uploadPreview?.byteSize ?? null,
        preview_width: uploadPreview?.width ?? null,
        preview_height: uploadPreview?.height ?? null,
      },
    }).eq('id', asset.id).select('*').single();
    if (updateError || !updated) return NextResponse.json({ error: updateError?.message ?? 'Unable to finalize asset' }, { status: 500 });

    if (moderation.decision === 'block') {
      return NextResponse.json({ error: 'Image blocked by safety policy', decision: moderation.decision, reasons: moderation.reasons }, { status: 422 });
    }
    if (moderation.decision === 'review') {
      return NextResponse.json({ error: 'Image requires safety review', asset: updated, decision: moderation.decision, reasons: moderation.reasons }, { status: 409 });
    }

    const { error: previewUploadError } = await admin.storage.from('solamentis-assets').upload(previewPath, uploadPreview!.buffer, { contentType: uploadPreview!.mimeType, cacheControl: '31536000, immutable', upsert: true });
    if (previewUploadError) throw new Error(`Upload preview storage failed: ${previewUploadError.message}`);

    const { data: previewAsset, error: previewAssetError } = await admin.from('assets').insert({
      user_id: user.id,
      project_id: asset.project_id ?? null,
      kind: 'preview',
      storage_path: previewPath,
      mime_type: uploadPreview!.mimeType,
      byte_size: uploadPreview!.byteSize,
      width: uploadPreview!.width,
      height: uploadPreview!.height,
      status: 'ready',
      metadata: {
        source_asset_id: asset.id,
        source_storage_path: asset.storage_path,
        source_byte_size: buffer.byteLength,
        role: 'upload_preview',
        storage_variant: 'preview',
      },
    }).select('*').single();
    if (previewAssetError || !previewAsset) throw new Error(previewAssetError?.message ?? 'Unable to save upload preview asset');

    const { data: signedPreview } = await admin.storage.from('solamentis-assets').createSignedUrl(previewPath, 3600);
    return NextResponse.json({
      asset: updated,
      preview: {
        assetId: previewAsset.id,
        storage_path: previewPath,
        mime_type: uploadPreview!.mimeType,
        byte_size: uploadPreview!.byteSize,
        width: uploadPreview!.width,
        height: uploadPreview!.height,
        url: signedPreview?.signedUrl ?? null,
      },
      original: { byte_size: buffer.byteLength, mime_type: mimeType, width: metadata.width, height: metadata.height },
      decision: moderation.decision,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload finalization failed';
    if (cleanupPaths.length) {
      try { await getSupabaseAdmin().storage.from('solamentis-assets').remove(cleanupPaths); } catch { /* cleanup is best-effort */ }
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
