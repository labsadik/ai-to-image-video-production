'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  ImagePlus,
  Loader2,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  WandSparkles,
  X,
  XCircle,
} from 'lucide-react';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';

type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
type Quality = 'preview' | 'standard' | 'premium';

type Job = {
  id: string;
  status: JobStatus;
  operation: string;
  prompt: string;
  size: string;
  quality: Quality;
  provider: string | null;
  model: string | null;
  output_path?: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  project_id?: string | null;
  request: Record<string, unknown>;
};

type Output = {
  id?: string;
  variant: 'preview' | 'editor' | 'export';
  storage_path: string;
  mime_type: string;
  width: number;
  height: number;
  byte_size: number;
  url: string | null;
};

type JobResponse = {
  job?: Job;
  outputUrl?: string | null;
  outputs?: Output[];
  error?: string;
};

type HistoryResponse = {
  job?: Job;
  project?: { id: string; name: string; platform: string; width: number; height: number } | null;
  outputs?: Output[];
  error?: string;
};

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

const statusCopy: Record<JobStatus, { label: string; detail: string }> = {
  queued: { label: 'Queued', detail: 'Your request is safely in the generation queue.' },
  processing: { label: 'Generating', detail: 'The configured provider is creating your visual.' },
  succeeded: { label: 'Ready', detail: 'Your visual passed the pipeline and is ready to use.' },
  failed: { label: 'Failed', detail: 'The generation could not be completed.' },
  cancelled: { label: 'Cancelled', detail: 'This generation was cancelled.' },
};

function preferredOutput(outputs: Output[] | undefined) {
  return outputs?.find(output => output.variant === 'editor' && output.url)
    ?? outputs?.find(output => output.variant === 'preview' && output.url)
    ?? outputs?.find(output => output.variant === 'export' && output.url)
    ?? null;
}

export default function CreatePage() {
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState<PlatformId>('youtube_thumbnail');
  const [quality, setQuality] = useState<Quality>('standard');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [message, setMessage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spec = PLATFORM_SPECS[platform];
  const isActive = job?.status === 'queued' || job?.status === 'processing';
  const status = job ? statusCopy[job.status] : null;

  async function loadJob(id: string) {
    try {
      const response = await fetch(`/api/generate/${id}`, { cache: 'no-store' });
      const data = (await response.json()) as JobResponse;
      if (!response.ok || !data.job) throw new Error(data.error || 'Unable to read generation status.');
      setJob(data.job);
      setOutputs(data.outputs ?? []);
      if (data.outputUrl) setOutputUrl(data.outputUrl);
      return data.job.status;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read generation status.');
      return null;
    }
  }

  async function loadHistory(id: string) {
    setLoadingHistory(true);
    setMessage('');
    try {
      const response = await fetch(`/api/history/${id}`, { cache: 'no-store' });
      const data = (await response.json()) as HistoryResponse;
      if (!response.ok || !data.job) throw new Error(data.error || 'Unable to open saved generation.');
      const request = data.job.request ?? {};
      const savedPlatform = typeof request.platform === 'string' && request.platform in PLATFORM_SPECS ? request.platform as PlatformId : undefined;
      setHistoryId(id);
      setJobId(id);
      setJob(data.job);
      setPrompt(data.job.prompt);
      setEditPrompt('');
      setQuality(data.job.quality);
      if (savedPlatform) setPlatform(savedPlatform);
      setOutputs(data.outputs ?? []);
      setOutputUrl(preferredOutput(data.outputs)?.url ?? null);
      setProjectName(data.project?.name ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open saved generation.');
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('history');
    if (id) void loadHistory(id);
  }, []);

  useEffect(() => {
    if (!jobId || job?.status === 'succeeded' || job?.status === 'failed' || job?.status === 'cancelled') return;
    let cancelled = false;
    const poll = async () => {
      const currentStatus = await loadJob(jobId);
      if (!cancelled && currentStatus && ['queued', 'processing'].includes(currentStatus)) pollTimer.current = setTimeout(poll, 1800);
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

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalOpen(false);
      if (event.key === '+' || event.key === '=') setZoom(value => Math.min(3, Number((value + 0.1).toFixed(2))));
      if (event.key === '-') setZoom(value => Math.max(0.5, Number((value - 0.1).toFixed(2))));
      if (event.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  function onZoomWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(value => Math.min(3, Math.max(0.5, Number((value + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)))));
  }

  function openPreview() {
    setZoom(1);
    setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setJob(null);
    setJobId(null);
    setHistoryId(null);
    setOutputs([]);
    setOutputUrl(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ operation: 'generateImage', prompt: prompt.trim(), platform, quality, size: `${spec.width}x${spec.height}`, width: spec.width, height: spec.height }),
      });
      const data = (await response.json()) as { jobId?: string; error?: string };
      if (!response.ok || !data.jobId) throw new Error(data.error || 'Generation could not be started.');
      setJobId(data.jobId);
      setMessage(`Generation started · ${data.jobId}`);
      await loadJob(data.jobId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function applyEdit(event: FormEvent) {
    event.preventDefault();
    if (!historyId || !editPrompt.trim() || editing) return;
    setEditing(true);
    setMessage('');
    try {
      const response = await fetch(`/api/history/${historyId}/edit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: editPrompt.trim(), quality }) });
      const data = (await response.json()) as { jobId?: string; error?: string };
      if (!response.ok || !data.jobId) throw new Error(data.error || 'Unable to create edit job.');
      setJobId(data.jobId);
      setHistoryId(data.jobId);
      setJob(null);
      setOutputs([]);
      setOutputUrl(null);
      setMessage(`Edit started · ${data.jobId}`);
      setEditPrompt('');
      window.history.replaceState({}, '', `/dashboard/create?history=${data.jobId}`);
      await loadJob(data.jobId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Edit request failed');
    } finally {
      setEditing(false);
    }
  }

  async function downloadCurrent(variant: 'preview' | 'editor' | 'export' = 'editor') {
    if (!historyId && !jobId) return;
    const id = historyId ?? jobId;
    const response = await fetch(`/api/history/${id}/download?variant=${variant}`, { cache: 'no-store' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      setMessage(data.error || 'Download failed.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `solamentis-${id}-${variant}.webp`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteCurrent() {
    if (!historyId) return;
    if (!window.confirm('Permanently delete this generation, saved image files, and its history? This cannot be undone.')) return;
    const response = await fetch(`/api/history/${historyId}`, { method: 'DELETE' });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(data.error || 'Unable to delete generation.');
      return;
    }
    window.location.href = '/dashboard/history';
  }

  const availablePreview = outputs.find(item => item.variant === 'preview' && item.url)?.url ?? outputUrl;
  const availableEditor = outputs.find(item => item.variant === 'editor' && item.url)?.url ?? outputUrl;

  return <div className="space-y-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Studio</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Turn an idea into a finished visual.</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Create new work or reopen a saved generation. The original prompt, settings, source image, editable image, and delivery files stay tied to the same secure history record.</p>
      </div>
      {historyId && <a href="/dashboard/history" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft className="size-4" /> History</a>}
    </div>

    {loadingHistory && <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700"><Loader2 className="size-4 animate-spin" /> Restoring your saved studio state…</div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><WandSparkles className="size-5" /></div>
          <div><p className="text-sm font-semibold">{historyId ? 'Saved generation' : 'New generation'}</p><p className="text-xs text-slate-400">Provider and model selection remain outside this workflow.</p></div>
        </div>

        <div className="mt-6 space-y-6">
          <label className="block text-sm font-medium">Platform<select value={platform} onChange={event => setPlatform(event.target.value as PlatformId)} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:ring-4 focus:ring-slate-100">{Object.keys(PLATFORM_SPECS).map(id => <option key={id} value={id}>{platformLabels[id as PlatformId]}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Quality<select value={quality} onChange={event => setQuality(event.target.value as Quality)} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:ring-4 focus:ring-slate-100"><option value="preview">Preview · 1 credit</option><option value="standard">Standard · 2–3 credits</option><option value="premium">Premium · 4–5 credits</option></select></label>
            <div className="rounded-xl bg-slate-50 p-3.5"><p className="text-xs font-medium text-slate-400">Canvas</p><p className="mt-1 text-sm font-semibold">{spec.width} × {spec.height}</p><p className="mt-1 text-[11px] text-slate-400">Maximum export {(spec.maxBytes / 1000000).toFixed(1)} MB</p></div>
          </div>
          <label className="block text-sm font-medium">Creative brief<textarea required minLength={3} rows={14} value={prompt} onChange={event => setPrompt(event.target.value)} className="mt-2 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3.5 leading-6 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" placeholder="Describe the subject, composition, lighting, style, text hierarchy, brand feel, and any constraints…" /></label>
          {message && <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">{message}</div>}
          {!historyId && <button disabled={loading || prompt.trim().length < 3 || isActive} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><Loader2 className="size-4 animate-spin" /> Starting generation…</> : isActive ? <><Loader2 className="size-4 animate-spin" /> Generation in progress…</> : <>Generate visual <ArrowRight className="size-4" /></>}</button>}
        </div>
      </form>

      <aside className="space-y-4">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Canvas</p><h2 className="mt-1 text-sm font-semibold">{projectName || 'Generated visual'}</h2></div>
            {job && <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${job.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : job.status === 'failed' || job.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{status?.label}</span>}
          </div>

          {availableEditor ? <div>
            <div className="bg-slate-100 p-3 sm:p-4">
              <button type="button" onClick={openPreview} className="group block w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 focus:outline-none focus:ring-4 focus:ring-blue-100" aria-label="Open image preview">
                <img src={availableEditor} alt="Generated visual" className="block h-auto max-h-[620px] w-full object-contain transition group-hover:scale-[1.01]" />
                <span className="flex items-center justify-center gap-2 border-t border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500"><Maximize2 className="size-3.5" /> Preview & zoom</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4 sm:grid-cols-4">
              <button type="button" onClick={openPreview} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Maximize2 className="size-4" /> Preview</button>
              <button type="button" onClick={() => void downloadCurrent('editor')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"><Download className="size-4" /> Download</button>
              <button type="button" onClick={() => void downloadCurrent('preview')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Save className="size-4" /> Preview file</button>
              {historyId && <button type="button" onClick={() => void deleteCurrent()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 className="size-4" /> Delete</button>}
            </div>
            {availablePreview && availablePreview !== availableEditor && <div className="border-t border-slate-100 px-4 py-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Saved preview</p><img src={availablePreview} alt="Saved preview" className="max-h-32 w-full rounded-xl bg-slate-50 object-contain" /></div>}
          </div> : job ? <div className="p-5"><div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center">{job.status === 'failed' || job.status === 'cancelled' ? <XCircle className="size-8 text-red-300" /> : job.status === 'succeeded' ? <ImagePlus className="size-8 text-slate-400" /> : <Loader2 className="size-8 animate-spin text-blue-500" />}<p className="mt-4 text-sm font-semibold text-slate-700">{status?.label}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{status?.detail}</p>{job.error_message && <p className="mt-3 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{job.error_message}</p>}{isActive && <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium text-slate-400"><Clock3 className="size-3.5" /> Checking automatically…</p>}</div></div> : <div className="p-5"><div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center"><div><ImagePlus className="mx-auto size-8 text-slate-300" /><p className="mt-4 text-sm font-semibold text-slate-600">Your generated visual appears here</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Generate an image and the production image canvas will appear here.</p></div></div></div>}
        </div>

        {historyId && job?.status === 'succeeded' && <form onSubmit={applyEdit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><Pencil className="size-4" /></div><div><p className="text-sm font-semibold">Edit this saved image</p><p className="text-xs text-slate-400">The original generation remains preserved in history.</p></div></div>
          <textarea required minLength={3} rows={5} value={editPrompt} onChange={event => setEditPrompt(event.target.value)} className="mt-4 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3.5 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" placeholder="Describe exactly what you want to change: subject, colors, lighting, composition, object removal, additions, and so on…" />
          <button disabled={editing || !editPrompt.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{editing ? <><Loader2 className="size-4 animate-spin" /> Applying edit…</> : <>Apply edit <WandSparkles className="size-4" /></>}</button>
        </form>}

        {job && <div className="rounded-3xl bg-slate-950 p-5 text-white"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-500">Generation details</p><p className="mt-2 text-sm text-slate-200">{job.operation}</p></div>{job.status === 'succeeded' && <CheckCircle2 className="size-5 text-emerald-400" />}</div><div className="mt-5 grid grid-cols-2 gap-3 text-[11px]"><div className="rounded-xl bg-white/5 p-3"><span className="text-slate-500">Canvas</span><p className="mt-1 text-slate-200">{job.request?.width as number} × {job.request?.height as number}</p></div><div className="rounded-xl bg-white/5 p-3"><span className="text-slate-500">Quality</span><p className="mt-1 capitalize text-slate-200">{job.quality}</p></div><div className="rounded-xl bg-white/5 p-3"><span className="text-slate-500">Provider</span><p className="mt-1 truncate text-slate-200">{job.provider || 'configured route'}</p></div><div className="rounded-xl bg-white/5 p-3"><span className="text-slate-500">Model</span><p className="mt-1 truncate text-slate-200">{job.model || 'configured model'}</p></div></div></div>}
      </aside>
    </div>

    {modalOpen && availableEditor && <div className="fixed inset-0 z-[100] bg-slate-950/90 p-4 sm:p-8" onWheel={onZoomWheel}>
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white sm:px-5"><div><p className="text-sm font-semibold">Image preview</p><p className="text-[11px] text-slate-400">Ctrl/Cmd + wheel or +/− to zoom · Esc to close</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => setZoom(value => Math.max(0.5, Number((value - 0.1).toFixed(2))))} className="rounded-lg p-2 hover:bg-white/10" aria-label="Zoom out"><Minus className="size-4" /></button><span className="min-w-14 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(value => Math.min(3, Number((value + 0.1).toFixed(2))))} className="rounded-lg p-2 hover:bg-white/10" aria-label="Zoom in"><Plus className="size-4" /></button><button type="button" onClick={() => setZoom(1)} className="rounded-lg px-2.5 py-2 text-[11px] font-semibold hover:bg-white/10">Reset</button><button type="button" onClick={() => setModalOpen(false)} className="ml-1 rounded-lg p-2 hover:bg-white/10" aria-label="Close preview"><X className="size-5" /></button></div></div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-950 p-4 sm:p-8"><div className="flex min-h-full min-w-full items-center justify-center"><img src={availableEditor} alt="Expanded generated visual" style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? '100%' : 'none' }} className="h-auto object-contain transition-[width] duration-150" /></div></div>
        <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-slate-400 sm:px-5"><span>{outputs.find(item => item.variant === 'editor')?.width ?? spec.width} × {outputs.find(item => item.variant === 'editor')?.height ?? spec.height}</span><button type="button" onClick={() => void downloadCurrent('editor')} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-900"><Download className="size-4" /> Download</button></div>
      </div>
    </div>}
  </div>;
}
