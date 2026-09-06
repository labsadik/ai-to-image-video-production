'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  RefreshCw,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';

const platformLabels: Record<PlatformId, string> = {
  youtube_thumbnail: 'YouTube Thumbnail',
  instagram_post: 'Instagram Post',
  instagram_story: 'Instagram Story',
  facebook_post: 'Facebook Post',
  facebook_cover: 'Facebook Cover',
  pinterest_pin: 'Pinterest Pin',
  linkedin_post: 'LinkedIn Post',
  x_post: 'X Post',
  ad_creative: 'Ad Creative',
  poster: 'Poster',
  website_banner: 'Website Banner',
};

type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

type JobResponse = {
  job?: {
    id: string;
    status: JobStatus;
    quality: string;
    provider: string | null;
    model: string | null;
    error_code: string | null;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
  };
  outputUrl?: string | null;
  error?: string;
};

const statusCopy: Record<JobStatus, { label: string; detail: string }> = {
  queued: { label: 'Queued', detail: 'Your request is safely in the generation queue.' },
  processing: { label: 'Generating', detail: 'The configured provider is creating your visual.' },
  succeeded: { label: 'Ready', detail: 'Your visual passed the pipeline and is ready to use.' },
  failed: { label: 'Failed', detail: 'The generation could not be completed.' },
  cancelled: { label: 'Cancelled', detail: 'This generation was cancelled.' },
};

export default function CreatePage() {
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState<PlatformId>('youtube_thumbnail');
  const [quality, setQuality] = useState<'preview' | 'standard' | 'premium'>('standard');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobResponse['job'] | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spec = PLATFORM_SPECS[platform];

  async function loadJob(id: string) {
    try {
      const response = await fetch(`/api/generate/${id}`, { cache: 'no-store' });
      const data = (await response.json()) as JobResponse;
      if (!response.ok || !data.job) {
        throw new Error(data.error || 'Unable to read generation status.');
      }

      setJob(data.job);
      if (data.outputUrl) setOutputUrl(data.outputUrl);
      return data.job.status;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read generation status.');
      return null;
    }
  }

  useEffect(() => {
    if (!jobId || job?.status === 'succeeded' || job?.status === 'failed' || job?.status === 'cancelled') {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      const status = await loadJob(jobId);
      if (!cancelled && status && ['queued', 'processing'].includes(status)) {
        pollTimer.current = setTimeout(poll, 1800);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [jobId, job?.status]);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setJob(null);
    setJobId(null);
    setOutputUrl(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          operation: 'generateImage',
          prompt: prompt.trim(),
          platform,
          quality,
          size: `${spec.width}x${spec.height}`,
          width: spec.width,
          height: spec.height,
        }),
      });
      const data = (await response.json()) as { jobId?: string; error?: string };
      if (!response.ok || !data.jobId) {
        throw new Error(data.error || 'Generation could not be started.');
      }

      setJobId(data.jobId);
      setMessage(`Generation started · ${data.jobId}`);
      await loadJob(data.jobId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const status = job ? statusCopy[job.status] : null;
  const isActive = job?.status === 'queued' || job?.status === 'processing';

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Create</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Turn an idea into a finished visual.</h1>
        <p className="mt-2 text-sm text-slate-500">Choose a destination, describe the visual, and Solamentis handles the provider, safety, queue, and export pipeline.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><WandSparkles className="size-5" /></div>
            <div>
              <p className="text-sm font-semibold">New generation</p>
              <p className="text-xs text-slate-400">One request, production-safe execution.</p>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <label className="block text-sm font-medium">
              Platform
              <select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformId)} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:ring-4 focus:ring-slate-100">
                {Object.keys(PLATFORM_SPECS).map((id) => <option key={id} value={id}>{platformLabels[id as PlatformId]}</option>)}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Quality
                <select value={quality} onChange={(event) => setQuality(event.target.value as typeof quality)} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:ring-4 focus:ring-slate-100">
                  <option value="preview">Preview · 1 credit</option>
                  <option value="standard">Standard · 2–3 credits</option>
                  <option value="premium">Premium · 4–5 credits</option>
                </select>
              </label>
              <div className="rounded-xl bg-slate-50 p-3.5">
                <p className="text-xs font-medium text-slate-400">Canvas</p>
                <p className="mt-1 text-sm font-semibold">{spec.width} × {spec.height}</p>
                <p className="mt-1 text-[11px] text-slate-400">Max export {(spec.maxBytes / 1000000).toFixed(1)} MB</p>
              </div>
            </div>

            <label className="block text-sm font-medium">
              Creative brief
              <textarea required minLength={3} rows={10} value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-2 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3.5 leading-6 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" placeholder="Describe the subject, composition, lighting, style, text hierarchy, brand feel, and any constraints…" />
            </label>

            {message && !job && (
              <div className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                <ImagePlus className="mt-0.5 size-4" />
                <span>{message}</span>
              </div>
            )}

            <button disabled={loading || prompt.trim().length < 3 || isActive} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <><Loader2 className="size-4 animate-spin" /> Starting generation…</> : isActive ? <><Loader2 className="size-4 animate-spin" /> Generation in progress…</> : <>Generate visual <ArrowRight className="size-4" /></>}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Live result</p>
                <h2 className="mt-1 text-sm font-semibold">Generation output</h2>
              </div>
              {job && <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${job.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : job.status === 'failed' || job.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{status?.label}</span>}
            </div>

            {outputUrl ? (
              <div>
                <div className="bg-slate-100 p-3 sm:p-4">
                  <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                    <img src={outputUrl} alt="Generated visual" className="block h-auto w-full object-contain" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4">
                  <a href={outputUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="size-4" /> Open full size</a>
                  <a href={outputUrl} download="solamentis-generated-image" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"><Download className="size-4" /> Download</a>
                </div>
              </div>
            ) : job ? (
              <div className="p-5">
                <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-100 via-white to-slate-200 p-5">
                  <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center">
                    {job.status === 'failed' || job.status === 'cancelled' ? <XCircle className="size-8 text-slate-400" /> : job.status === 'succeeded' ? <ImagePlus className="size-8 text-slate-400" /> : <Loader2 className="size-8 animate-spin text-slate-400" />}
                    <p className="mt-4 text-sm font-semibold text-slate-700">{status?.label}</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{status?.detail}</p>
                    {job.status === 'failed' && job.error_message && <p className="mt-3 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{job.error_message}</p>}
                    {isActive && <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium text-slate-400"><Clock3 className="size-3.5" /> Checking automatically…</p>}
                  </div>
                </div>
                {jobId && <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-400"><span className="truncate">Job {jobId}</span>{job.status !== 'succeeded' && <button type="button" onClick={() => void loadJob(jobId)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"><RefreshCw className="size-3.5" /> Refresh</button>}</div>}
              </div>
            ) : (
              <div className="p-5">
                <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-100 via-white to-slate-200 p-5">
                  <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center">
                    <ImagePlus className="size-8 text-slate-300" />
                    <p className="mt-4 text-sm font-semibold text-slate-600">Your generated visual appears here</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Submit a prompt and this panel will follow the job until the finished image is available.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-slate-950 p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">Pipeline</p>
            <div className="mt-5 space-y-4">
              {['Validate prompt and plan limits', 'Reserve credits and create job', 'Queue and route to configured provider', 'Moderate generated image', 'Optimize, watermark, and secure delivery'].map((step, index) => (
                <div key={step} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 text-xs font-semibold">{index + 1}</span>
                  <p className="pt-1 text-sm text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold">Provider choice stays out of the UI</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Compatible provider/model changes are handled by the configuration layer rather than by editing this workflow.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
