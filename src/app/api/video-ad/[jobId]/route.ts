import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';
const TTL_SECONDS = 3600;
type VideoOutput = { id: string; variant: string; storage_path: string; mime_type: string; width: number | null; height: number | null; byte_size: number | null; created_at: string };

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: job, error: jobError } = await admin
    .from('generation_jobs')
    .select('id,status,quality,provider,model,output_path,error_code,error_message,created_at,completed_at,project_id,request,operation')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .eq('operation', 'generateVideoAd')
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: `Video job lookup failed: ${jobError.message}` }, { status: 500 });
  if (!job) return NextResponse.json({ error: 'Video job not found' }, { status: 404 });

  const { data: outputs, error: outputError } = await admin
    .from('generation_outputs')
    .select('id,variant,storage_path,mime_type,width,height,byte_size,created_at')
    .eq('job_id', job.id)
    .in('variant', ['master', 'preview']);

  if (outputError) return NextResponse.json({ error: `Video output lookup failed: ${outputError.message}` }, { status: 500 });

  async function signOutput(output: VideoOutput | null) {
    if (!output) return null;
    const { data, error } = await admin.storage.from('solamentis-assets').createSignedUrl(output.storage_path, TTL_SECONDS);
    return { ...output, url: error ? null : data?.signedUrl ?? null };
  }

  const master = await signOutput((outputs ?? []).find((item) => item.variant === 'master') ?? null);
  const preview = await signOutput((outputs ?? []).find((item) => item.variant === 'preview') ?? null);

  return NextResponse.json(
    { job, outputUrl: master?.url ?? null, output: master, preview },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
