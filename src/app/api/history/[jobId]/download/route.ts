import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { consumeRateLimit } from '@/server/rate-limit';
import { logServerError } from '@/server/production-log';

export const runtime = 'nodejs';

function extension(mimeType: string | null, operation: string | null) {
  if (operation === 'generateVideoAd' || mimeType?.startsWith('video/')) return '.mp4';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  return '.webp';
}

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = await consumeRateLimit(`user:${user.id}:history-download`, 30, 60);
    if (!rate.allowed) return NextResponse.json({ error: 'Download rate limit exceeded', retryAfterSeconds: rate.retryAfterSeconds }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } });

    const { jobId } = await params;
    const admin = getSupabaseAdmin();
    const { data: job } = await admin.from('generation_jobs').select('id,status,operation').eq('id', jobId).eq('user_id', user.id).maybeSingle();
    if (!job) return NextResponse.json({ error: 'History item not found' }, { status: 404 });

    const { data: output, error: outputError } = await admin.from('generation_outputs').select('storage_path,mime_type').eq('job_id', job.id).eq('variant', 'master').maybeSingle();
    if (outputError) throw new Error(`Output lookup failed: ${outputError.message}`);
    if (!output) return NextResponse.json({ error: 'Saved master output is unavailable for this history item' }, { status: 404 });

    const { data, error } = await admin.storage.from('solamentis-assets').download(output.storage_path);
    if (error || !data) throw new Error(`Master download failed: ${error?.message ?? 'file unavailable'}`);
    const suffix = extension(output.mime_type, job.operation);

    return new NextResponse(data, {
      headers: {
        'Content-Type': output.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="solamentis-${job.id}${suffix}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    logServerError('history.download_failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to download master output' }, { status: 400 });
  }
}
