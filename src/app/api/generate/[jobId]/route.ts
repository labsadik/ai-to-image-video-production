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
  const { data: job, error } = await admin.from('generation_jobs').select('id,status,quality,provider,model,output_path,error_code,error_message,created_at,completed_at,project_id,request').eq('id', jobId).eq('user_id', user.id).single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const { data: outputs } = await admin.from('generation_outputs').select('variant,storage_path,mime_type,width,height,byte_size').eq('job_id', job.id).in('variant', ['preview', 'editor', 'export']);
  const signed = await Promise.all((outputs ?? []).map(async output => {
    const { data, error: signError } = await admin.storage.from('solamentis-assets').createSignedUrl(output.storage_path, 3600);
    return { ...output, url: signError ? null : data?.signedUrl ?? null };
  }));
  const preferred = signed.find(item => item.variant === 'editor' && item.url) ?? signed.find(item => item.variant === 'preview' && item.url) ?? signed.find(item => item.variant === 'export' && item.url);
  return NextResponse.json({ job, outputUrl: preferred?.url ?? null, outputs: signed });
}
