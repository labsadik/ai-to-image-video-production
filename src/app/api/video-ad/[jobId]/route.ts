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
  const { data: job, error } = await admin.from('generation_jobs').select('id,status,operation,quality,provider,model,output_path,error_code,error_message,created_at,completed_at,request').eq('id', jobId).eq('user_id', user.id).single();
  if (error || !job || job.operation !== 'generateVideoAd') return NextResponse.json({ error: 'Video ad job not found' }, { status: 404 });
  const { data: output } = await admin.from('generation_outputs').select('variant,storage_path,mime_type,width,height,byte_size').eq('job_id', job.id).eq('variant', 'master').maybeSingle();
  let url: string | null = null;
  if (output) {
    const { data: signed } = await admin.storage.from('solamentis-assets').createSignedUrl(output.storage_path, 3600);
    url = signed?.signedUrl ?? null;
  }
  return NextResponse.json({ job, output: output ? { ...output, url } : null, outputUrl: url });
}
