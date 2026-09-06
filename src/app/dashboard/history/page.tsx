import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { HistoryList } from '@/components/history-list';

export default async function HistoryPage() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdmin();
  const { data: jobs } = await admin.from('generation_jobs').select('id,status,operation,prompt,size,quality,created_at,completed_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  const jobIds = (jobs ?? []).map(job => job.id);
  const { data: outputs } = jobIds.length
    ? await admin.from('generation_outputs').select('job_id,variant,storage_path').in('job_id', jobIds).in('variant', ['editor', 'preview'])
    : { data: [] };

  const preferredPaths = new Map<string, string>();
  for (const output of outputs ?? []) {
    if (output.variant === 'editor' || !preferredPaths.has(output.job_id)) preferredPaths.set(output.job_id, output.storage_path);
  }
  const signed = await Promise.all([...preferredPaths.entries()].map(async ([jobId, path]) => {
    const { data } = await admin.storage.from('solamentis-assets').createSignedUrl(path, 3600);
    return [jobId, data?.signedUrl ?? null] as const;
  }));
  const signedMap = new Map(signed);

  const items = (jobs ?? []).map(job => ({
    id: job.id,
    prompt: job.prompt,
    operation: job.operation,
    size: job.size,
    quality: job.quality,
    status: job.status,
    created_at: job.created_at,
    completed_at: job.completed_at,
    previewUrl: signedMap.get(job.id) ?? null,
  }));

  return <div className="space-y-8">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">History</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your generations</h1>
      <p className="mt-2 text-sm text-slate-500">Open any completed generation in Studio to inspect its original prompt, image, settings, and edit it without losing the source history.</p>
    </div>
    <HistoryList initialItems={items} />
  </div>;
}
