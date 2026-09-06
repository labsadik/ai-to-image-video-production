import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

async function getUser() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

async function loadOwnedJob(jobId: string, userId: string) {
  const admin = getSupabaseAdmin();
  const { data: job, error } = await admin.from('generation_jobs').select('*').eq('id', jobId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`History lookup failed: ${error.message}`);
  if (!job) return null;
  return job;
}

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { jobId } = await params;
    const admin = getSupabaseAdmin();
    const job = await loadOwnedJob(jobId, user.id);
    if (!job) return NextResponse.json({ error: 'History item not found' }, { status: 404 });

    const [{ data: outputs, error: outputsError }, projectResult] = await Promise.all([
      admin.from('generation_outputs').select('id,variant,storage_path,mime_type,width,height,byte_size,created_at').eq('job_id', job.id).order('variant'),
      job.project_id ? admin.from('projects').select('id,name,platform,width,height,metadata,created_at,updated_at').eq('id', job.project_id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (outputsError) throw new Error(`History outputs lookup failed: ${outputsError.message}`);

    const signedOutputs = await Promise.all((outputs ?? []).map(async output => {
      const { data, error } = await admin.storage.from('solamentis-assets').createSignedUrl(output.storage_path, 3600);
      return { ...output, url: error ? null : data?.signedUrl ?? null };
    }));

    return NextResponse.json({ job, project: projectResult.data ?? null, outputs: signedOutputs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load history item' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { jobId } = await params;
    const admin = getSupabaseAdmin();
    const job = await loadOwnedJob(jobId, user.id);
    if (!job) return NextResponse.json({ error: 'History item not found' }, { status: 404 });

    const [{ data: outputs, error: outputsError }, { data: failures, error: failuresError }, { data: safetyEvents, error: safetyError }, { data: assets, error: assetsError }] = await Promise.all([
      admin.from('generation_outputs').select('storage_path').eq('job_id', job.id),
      admin.from('job_failures').select('id').eq('job_id', job.id),
      admin.from('safety_events').select('id').eq('job_id', job.id),
      admin.from('assets').select('id,storage_path').eq('user_id', user.id).eq('metadata->>job_id', job.id),
    ]);
    if (outputsError) throw new Error(`History outputs lookup failed: ${outputsError.message}`);
    if (failuresError) throw new Error(`History failure lookup failed: ${failuresError.message}`);
    if (safetyError) throw new Error(`History safety lookup failed: ${safetyError.message}`);
    if (assetsError) throw new Error(`History asset lookup failed: ${assetsError.message}`);

    const paths = Array.from(new Set([
      job.output_path,
      ...(outputs ?? []).map(item => item.storage_path),
      ...(assets ?? []).map(item => item.storage_path),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)));
    if (paths.length) {
      const { error: storageError } = await admin.storage.from('solamentis-assets').remove(paths);
      if (storageError) throw new Error(`History asset removal failed: ${storageError.message}`);
    }

    const deleteSteps = [
      admin.from('generation_outputs').delete().eq('job_id', job.id),
      admin.from('job_failures').delete().eq('job_id', job.id),
      admin.from('safety_events').delete().eq('job_id', job.id),
      admin.from('credit_ledger').delete().eq('job_id', job.id).eq('user_id', user.id),
      admin.from('assets').delete().eq('user_id', user.id).eq('metadata->>job_id', job.id),
    ];
    for (const operation of deleteSteps) {
      const { error } = await operation;
      if (error) throw new Error(`History database deletion failed: ${error.message}`);
    }

    const { error: jobDeleteError } = await admin.from('generation_jobs').delete().eq('id', job.id).eq('user_id', user.id);
    if (jobDeleteError) throw new Error(`History job deletion failed: ${jobDeleteError.message}`);

    return NextResponse.json({ deleted: true, jobId: job.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to delete history item' }, { status: 400 });
  }
}
