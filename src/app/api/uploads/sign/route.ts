import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { GENERATION_PLANS } from '@/config/plans';
import { consumeRateLimit } from '@/server/rate-limit';

export const runtime = 'nodejs';

const ALLOWED_UPLOAD_TYPE = 'image/webp';
const MAX_BYTES = 6_000_000;

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await consumeRateLimit(`user:${user.id}:upload-sign`, 30, 60);
    if (!rate.allowed) return NextResponse.json(
      { error: 'Upload rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );

    const body = await request.json() as { mimeType?: string; byteSize?: number; projectId?: string };
    if (body.mimeType !== ALLOWED_UPLOAD_TYPE || typeof body.byteSize !== 'number' || !Number.isInteger(body.byteSize) || body.byteSize <= 0 || body.byteSize > MAX_BYTES) {
      return NextResponse.json({ error: 'Uploads must be compressed WebP images of 6 MB or smaller' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin.from('profiles').select('plan').eq('id', user.id).single();
    if (profileError || !profile || !(profile.plan in GENERATION_PLANS)) return NextResponse.json({ error: 'Account configuration unavailable' }, { status: 409 });

    if (body.projectId) {
      const { data: project } = await admin.from('projects').select('id').eq('id', body.projectId).eq('user_id', user.id).single();
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const { count } = await admin.from('assets').select('id', { count: 'exact', head: true }).eq('project_id', body.projectId).eq('kind', 'upload');
      const limit = GENERATION_PLANS[profile.plan as keyof typeof GENERATION_PLANS].maxUploadsPerProject;
      if ((count ?? 0) >= limit) return NextResponse.json({ error: 'Project upload limit reached' }, { status: 429 });
    }

    const path = `${user.id}/uploads/${randomUUID()}.webp`;
    const { data: signed, error: signedError } = await admin.storage.from('solamentis-assets').createSignedUploadUrl(path, { upsert: false });
    if (signedError || !signed) return NextResponse.json({ error: signedError?.message ?? 'Unable to create signed upload URL' }, { status: 500 });

    const { data: asset, error: assetError } = await admin.from('assets').insert({
      user_id: user.id,
      project_id: body.projectId ?? null,
      kind: 'upload',
      storage_path: path,
      mime_type: ALLOWED_UPLOAD_TYPE,
      byte_size: body.byteSize,
      status: 'uploading',
      metadata: {
        upload_issued_at: new Date().toISOString(),
        declared_byte_size: body.byteSize,
        storage_variant: 'compressed_master',
        compression_required: true,
      },
    }).select('id').single();
    if (assetError || !asset) {
      await admin.storage.from('solamentis-assets').remove([path]);
      return NextResponse.json({ error: assetError?.message ?? 'Unable to create asset record' }, { status: 500 });
    }

    return NextResponse.json({ assetId: asset.id, path: signed.path, token: signed.token, expiresInSeconds: 7200, maxBytes: MAX_BYTES, mimeType: ALLOWED_UPLOAD_TYPE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload authorization failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
