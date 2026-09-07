import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { logServerError } from '@/server/production-log';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  let userId = '';
  try {
    const { assetId } = await params;
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = user.id;

    const rate = await consumeRateLimit(`user:${user.id}:asset-signed-url`, 60, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Asset access rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

    const admin = getSupabaseAdmin();
    const { data: asset, error: assetError } = await admin.from('assets').select('storage_path,status').eq('id', assetId).eq('user_id', user.id).single();
    if (assetError || !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    if (asset.status !== 'ready') {
      return NextResponse.json({ error: asset.status === 'review' ? 'Asset is awaiting safety review' : 'Asset is not approved for delivery' }, { status: 403 });
    }

    const ttl = 3600;
    const { data, error } = await admin.storage.from('solamentis-assets').createSignedUrl(asset.storage_path, ttl);
    if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message ?? 'Unable to create signed URL' }, { status: 500 });
    return NextResponse.json({ url: data.signedUrl, expiresInSeconds: ttl });
  } catch (error) {
    logServerError('asset.signed_url_failed', error, { userId });
    const message = error instanceof Error ? error.message : 'Unable to create signed URL';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
