import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { assetId?: string };
    if (!body.assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: asset, error: assetError } = await admin.from('assets').select('*').eq('id', body.assetId).eq('user_id', user.id).single();
    if (assetError || !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const { data: blob, error: downloadError } = await admin.storage.from('solamentis-assets').download(asset.storage_path);
    if (downloadError || !blob) return NextResponse.json({ error: 'Uploaded file could not be read' }, { status: 422 });

    const buffer = Buffer.from(await blob.arrayBuffer());
    const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) return NextResponse.json({ error: 'Invalid image file' }, { status: 422 });

    const allowedFormats = new Set(['jpeg', 'png', 'webp']);
    if (!allowedFormats.has(metadata.format)) return NextResponse.json({ error: 'Unsupported image format' }, { status: 422 });

    const { data: updated, error: updateError } = await admin.from('assets').update({ status: 'ready', byte_size: buffer.byteLength, width: metadata.width, height: metadata.height, mime_type: `image/${metadata.format}`, metadata: { ...(asset.metadata ?? {}), validated_at: new Date().toISOString() } }).eq('id', asset.id).select('*').single();
    if (updateError || !updated) return NextResponse.json({ error: updateError?.message ?? 'Unable to finalize asset' }, { status: 500 });

    return NextResponse.json({ asset: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload finalization failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
