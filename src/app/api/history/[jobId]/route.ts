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
  return job;
}

function readLegacyPaths(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const value = (metadata as Record<string, unknown>).legacy_storage_paths;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

async function signedOutput(admin: ReturnType<typeof getSupabaseAdmin>, output: { id: string; variant: string; storage_path: string; mime_type: string; width: number; height: number; byte_size: number; created_at: string } | null) {
  if (!output) return null;
  const { data, error } = await admin.storage.from('solamentis-assets').createSignedUrl(output.storage_path, 3600);
  return { ...output, url: error ? null : data?.signedUrl ?? null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { jobId } = await params;
    const admin = getSupabaseAdmin();
    const job = await loadOwnedJob(jobId, user.id);
    if (!job) return NextResponse.json({ error: 'History item not found' }, { status: 404 });

    const [{ data: outputs, error: outputError }, projectResult] = await Promise.all([
      admin.from('generation_outputs').select('id,variant,storage_path,mime_type,width,height,byte_size,created_at').eq('job_id', job.id).in('variant', ['master', 'preview']),
      job.project_id ? admin.from('projects').select('id,name,platform,width,height,metadata,created_at,updated_at').eq('id', job.project_id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (outputError) throw new Error(`History output lookup failed: ${outputError.message}`);

    const master = await signedOutput(admin, (outputs ?? []).find(item => item.variant === 'master') ?? null);
    const preview = await signedOutput(admin, (outputs ?? []).find(item => item.variant === 'preview') ?? null);
    return NextResponse.json({ job, project: projectResult.data ?? null, output: master, preview });
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
    if (job.status === 'processing') return NextResponse.json({ error: 'This generation is still processing. Delete it after it finishes or is cancelled.' }, { status: 409 });

    const [{ data: outputs, error: outputsError }, { data: failures, error: failuresError }, { data: safetyEvents, error: safetyError }, { data: assets, error: assetsError }] = await Promise.all([
      admin.from('generation_outputs').select('storage_path').eq('job_id', job.id),
      admin.from('job_failures').select('id').eq('job_id', job.id),
      admin.from('safety_events').select('id').eq('job_id', job.id),
      admin.from('assets').select('id,storage_path,metadata').eq('user_id', user.id).eq('metadata->>job_id', job.id),
    ]);
    if (outputsError) throw new Error(`History outputs lookup failed: ${outputsError.message}`);
    if (failuresError) throw new Error(`History failure lookup failed: ${failuresError.message}`);
    if (safetyError) throw new Error(`History safety lookup failed: ${safetyError.message}`);
    if (assetsError) throw new Error(`History asset lookup failed: ${assetsError.message}`);

    const paths = new Set<string>([
      job.output_path,
      ...(outputs ?? []).map(item => item.storage_path),
      ...(assets ?? []).flatMap(item => [item.storage_path, ...readLegacyPaths(item.metadata)]),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0));

    if (paths.size) {
      const { error: storageError } = await admin.storage.from('solamentis-assets').remove([...paths]);
      if (storageError) throw new Error(`History asset removal failed: ${storageError.message}`);
    }

    for (const operation of [
      admin.from('generation_outputs').delete().eq('job_id', job.id),
      admin.from('job_failures').delete().eq('job_id', job.id),
      admin.from('safety_events').delete().eq('job_id', job.id),
      admin.from('assets').delete().eq('user_id', user.id).eq('metadata->>job_id', job.id),
    ]) {
      const { error } = await operation;
      if (error) throw new Error(`History database deletion failed: ${error.message}`);
    }

    // Keep the credit ledger immutable for auditability. Creative history deletion must not erase accounting records.
    const { error: jobDeleteError } = await admin.from('generation_jobs').delete().eq('id', job.id).eq('user_id', user.id);
    if (jobDeleteError) throw new Error(`History job deletion failed: ${jobDeleteError.message}`);
    return NextResponse.json({ deleted: true, jobId: job.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to delete history item' }, { status: 400 });
  }
}
