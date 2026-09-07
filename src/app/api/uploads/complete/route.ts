import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { moderateImage } from '@/server/image-moderation';
import { createMediaPreview } from '@/lib/media/preview';
import { compressImageForStorage, MAX_STORAGE_IMAGE_BYTES } from '@/lib/media/compressed-image';
import { logServerError } from '@/server/production-log';

export const runtime = 'nodejs';
const MAX_UPLOAD_BYTES = 6_000_000;
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

    const uploadedBuffer = Buffer.from(await blob.arrayBuffer());
    if (uploadedBuffer.byteLength <= 0 || uploadedBuffer.byteLength > MAX_UPLOAD_BYTES) {
      await admin.storage.from('solamentis-assets').remove([asset.storage_path]);
      await admin.from('assets').update({ status: 'blocked', metadata: { ...(asset.metadata ?? {}), validation_error: 'upload_size_exceeded', validated_at: new Date().toISOString() } }).eq('id', asset.id);
      return NextResponse.json({ error: 'Uploaded file must be 6 MB or smaller' }, { status: 422 });
    }

    const sourceMetadata = await sharp(uploadedBuffer, { failOn: 'error' }).metadata();
    if (!sourceMetadata.width || !sourceMetadata.height || !sourceMetadata.format) return NextResponse.json({ error: 'Invalid image file' }, { status: 422 });
    if (sourceMetadata.width * sourceMetadata.height > MAX_PIXELS) return NextResponse.json({ error: 'Image dimensions exceed processing limits' }, { status: 422 });
    if (sourceMetadata.format !== 'webp') return NextResponse.json({ error: 'Upload must be compressed WebP' }, { status: 415 });

    const stored = await compressImageForStorage(uploadedBuffer, { maxBytes: MAX_STORAGE_IMAGE_BYTES });
    const checksum = createHash('sha256').update(stored.buffer).digest('hex');
    const declaredSize = Number((asset.metadata as Record<string, unknown> | null)?.declared_byte_size ?? asset.byte_size);
    if (!Number.isSafeInteger(declaredSize) || declaredSize <= 0 || declaredSize > MAX_UPLOAD_BYTES || declaredSize !== uploadedBuffer.byteLength) {
      await admin.storage.from('solamentis-assets').remove([asset.storage_path]);
      await admin.from('assets').update({ status: 'blocked', metadata: { ...(asset.metadata ?? {}), validation_error: 'declared_size_mismatch', uploaded_byte_size: uploadedBuffer.byteLength, validated_at: new Date().toISOString() } }).eq('id', asset.id);
      return NextResponse.json({ error: 'Upload size could not be validated' }, { status: 422 });
    }

    const moderation = await moderateImage({
      mimeType: stored.mimeType,
      base64: stored.buffer.toString('base64'),
      userId: user.id,
      assetId: asset.id,
      stage: 'upload',
    });
    const status = moderation.decision === 'allow' ? 'ready' : moderation.decision === 'review' ? 'review' : 'blocked';

    if (moderation.decision !== 'allow') {
      await admin.storage.from('solamentis-assets').remove([asset.storage_path]);
      await admin.from('assets').update({
        status,
        byte_size: stored.byteSize,
        width: stored.width,
        height: stored.height,
        mime_type: stored.mimeType,
        checksum,
        metadata: {
          ...(asset.metadata ?? {}),
          validated_at: new Date().toISOString(),
          uploaded_byte_size: uploadedBuffer.byteLength,
          declared_size_matches_upload: true,
          stored_byte_size: stored.byteSize,
          compression_quality: stored.quality,
          moderation_decision: moderation.decision,
          moderation_provider: moderation.provider,
          moderation_model: moderation.model,
          storage_variant: 'compressed_master',
        },
      }).eq('id', asset.id);
      return NextResponse.json({ error: moderation.decision === 'block' ? 'Image blocked by safety policy' : 'Image requires safety review', decision: moderation.decision, reasons: moderation.reasons }, { status: moderation.decision === 'block' ? 422 : 409 });
    }

    const { error: normalizedUploadError } = await admin.storage.from('solamentis-assets').upload(asset.storage_path, stored.buffer, { contentType: stored.mimeType, cacheControl: '31536000, immutable', upsert: true });
    if (normalizedUploadError) throw new Error(`Compressed image storage failed: ${normalizedUploadError.message}`);

    const preview = await createMediaPreview(stored.buffer);
    const previewPath = `${asset.storage_path}.preview.webp`;
    cleanupPaths.push(previewPath);
    const { error: previewUploadError } = await admin.storage.from('solamentis-assets').upload(previewPath, preview.buffer, { contentType: preview.mimeType, cacheControl: '31536000, immutable', upsert: true });
    if (previewUploadError) throw new Error(`Preview storage failed: ${previewUploadError.message}`);

    const { data: updated, error: updateError } = await admin.from('assets').update({
      status: 'ready',
      byte_size: stored.byteSize,
      width: stored.width,
      height: stored.height,
      mime_type: stored.mimeType,
      checksum,
      metadata: {
        ...(asset.metadata ?? {}),
        validated_at: new Date().toISOString(),
        uploaded_byte_size: uploadedBuffer.byteLength,
        declared_size_matches_upload: true,
        stored_byte_size: stored.byteSize,
        compression_quality: stored.quality,
        moderation_decision: moderation.decision,
        moderation_provider: moderation.provider,
        moderation_model: moderation.model,
        storage_variant: 'compressed_master',
        preview_storage_path: previewPath,
        preview_byte_size: preview.byteSize,
        preview_width: preview.width,
        preview_height: preview.height,
      },
    }).eq('id', asset.id).select('*').single();
    if (updateError || !updated) throw new Error(updateError?.message ?? 'Unable to finalize asset');

    const { data: previewAsset, error: previewAssetError } = await admin.from('assets').insert({
      user_id: user.id,
      project_id: asset.project_id ?? null,
      kind: 'preview',
      storage_path: previewPath,
      mime_type: preview.mimeType,
      byte_size: preview.byteSize,
      width: preview.width,
      height: preview.height,
      status: 'ready',
      metadata: {
        source_asset_id: asset.id,
        source_storage_path: asset.storage_path,
        source_byte_size: stored.byteSize,
        role: 'upload_preview',
        storage_variant: 'preview',
      },
    }).select('*').single();
    if (previewAssetError || !previewAsset) throw new Error(previewAssetError?.message ?? 'Unable to save upload preview asset');

    const { data: signedPreview } = await admin.storage.from('solamentis-assets').createSignedUrl(previewPath, 3600);
    return NextResponse.json({
      asset: updated,
      stored: { byte_size: stored.byteSize, mime_type: stored.mimeType, width: stored.width, height: stored.height, compression_quality: stored.quality },
      preview: {
        assetId: previewAsset.id,
        storage_path: previewPath,
        mime_type: preview.mimeType,
        byte_size: preview.byteSize,
        width: preview.width,
        height: preview.height,
        url: signedPreview?.signedUrl ?? null,
      },
      source: { byte_size: uploadedBuffer.byteLength, mime_type: 'image/webp' },
      decision: moderation.decision,
    });
  } catch (error) {
    logServerError('uploads.complete_failed', error);
    if (cleanupPaths.length) {
      try { await getSupabaseAdmin().storage.from('solamentis-assets').remove(cleanupPaths); } catch { /* cleanup is best-effort */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload finalization failed' }, { status: 400 });
  }
}
