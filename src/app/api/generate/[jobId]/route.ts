import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: job, error } = await admin.from('generation_jobs').select('id,status,quality,provider,model,output_path,error_code,error_message,created_at,completed_at').eq('id', jobId).eq('user_id', user.id).single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  let outputUrl: string | null = null;
  if (job.status === 'succeeded' && job.output_path) {
    const { data } = await admin.storage.from('solamentis-assets').createSignedUrl(job.output_path, 3600);
    outputUrl = data?.signedUrl ?? null;
  }
  return NextResponse.json({ job, outputUrl });
}
