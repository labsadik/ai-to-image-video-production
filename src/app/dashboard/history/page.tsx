import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { HistoryList } from '@/components/history-list';

export default async function HistoryPage() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdmin();
  const { data: jobs } = await admin.from('generation_jobs').select('id,status,operation,prompt,size,quality,created_at,completed_at,request').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  const jobIds = (jobs ?? []).map(job => job.id);
  const { data: outputs } = jobIds.length
    ? await admin.from('generation_outputs').select('job_id,variant,storage_path,mime_type,width,height,byte_size').in('job_id', jobIds).in('variant', ['master', 'preview'])
    : { data: [] };

  const signed = await Promise.all((outputs ?? []).map(async output => {
    const { data } = await admin.storage.from('solamentis-assets').createSignedUrl(output.storage_path, 3600);
    return [`${output.job_id}:${output.variant}`, data?.signedUrl ?? null] as const;
  }));
  const signedMap = new Map(signed);

  const items = (jobs ?? []).map(job => {
    const master = (outputs ?? []).find(output => output.job_id === job.id && output.variant === 'master');
    const preview = (outputs ?? []).find(output => output.job_id === job.id && output.variant === 'preview');
    const request = (job.request ?? {}) as Record<string, unknown>;
    return {
      id: job.id,
      prompt: job.prompt,
      operation: job.operation,
      size: job.size,
      quality: job.quality,
      status: job.status,
      created_at: job.created_at,
      completed_at: job.completed_at,
      previewUrl: signedMap.get(`${job.id}:preview`) ?? signedMap.get(`${job.id}:master`) ?? null,
      masterByteSize: master?.byte_size ?? (typeof request.originalByteSize === 'number' ? request.originalByteSize : null),
      previewByteSize: preview?.byte_size ?? (typeof request.previewByteSize === 'number' ? request.previewByteSize : null),
      mimeType: master?.mime_type ?? (typeof request.originalMimeType === 'string' ? request.originalMimeType : null),
      width: master?.width ?? (typeof request.width === 'number' ? request.width : null),
      height: master?.height ?? (typeof request.height === 'number' ? request.height : null),
    };
  });

  return <div className="space-y-8">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">History</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your media history</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Images, videos, and authenticity analyses use the same private storage and history system. Analysis records retain the original upload plus a compressed preview so you can compare sizes later.</p>
    </div>
    <HistoryList initialItems={items} />
  </div>;
}
