import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';

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

    const { data: updated, error: updateError } = await admin.from('assets').update({
      status: 'ready',
      byte_size: buffer.byteLength,
      width: metadata.width,
      height: metadata.height,
      mime_type: mimeType,
      checksum,
      metadata: { ...(asset.metadata ?? {}), validated_at: new Date().toISOString(), declared_size_matches: declaredSize === buffer.byteLength },
    }).eq('id', asset.id).select('*').single();
    if (updateError || !updated) return NextResponse.json({ error: updateError?.message ?? 'Unable to finalize asset' }, { status: 500 });

    await admin.from('safety_events').insert({
      user_id: user.id,
      asset_id: asset.id,
      policy_version: null,
      stage: 'upload_validation',
      decision: 'allow',
      reasons: ['Image passed structural validation'],
      score: 0,
    });

    return NextResponse.json({ asset: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload finalization failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
