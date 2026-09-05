import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { moderateImage } from '@/server/image-moderation';

export const runtime = 'nodejs';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;

export async function POST(request: Request) {
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
      stage: 'upload_image_moderation',
    });
    const status = moderation.decision === 'allow' ? 'ready' : moderation.decision === 'review' ? 'review' : 'blocked';

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
      },
    }).eq('id', asset.id).select('*').single();
    if (updateError || !updated) return NextResponse.json({ error: updateError?.message ?? 'Unable to finalize asset' }, { status: 500 });

    if (moderation.decision === 'block') {
      return NextResponse.json({ error: 'Image blocked by safety policy', decision: moderation.decision, reasons: moderation.reasons }, { status: 422 });
    }
    if (moderation.decision === 'review') {
      return NextResponse.json({ error: 'Image requires safety review', asset: updated, decision: moderation.decision, reasons: moderation.reasons }, { status: 409 });
    }

    return NextResponse.json({ asset: updated, decision: moderation.decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload finalization failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
