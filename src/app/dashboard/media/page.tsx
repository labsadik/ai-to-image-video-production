'use client';

import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Coins, Download, FileSearch, ImagePlus, Loader2, ScanSearch, Sparkles, Trash2, UploadCloud, Video, XCircle } from 'lucide-react';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';
import { ImageUpload, type UploadedReference } from '@/components/image-upload';

type Mode = 'image' | 'analysis' | 'video';
type Quality = 'preview' | 'standard' | 'premium';
type AnalysisLevel = 'basic' | 'medium' | 'hard';
type Usage = {
  plan: 'free' | 'pro' | 'business';
  credits: { monthly: number; monthlyRemaining: number; addon: number; used: number; reserved: number; available: number };
  features: { imageGeneration: { preview: number; standard: number; premium: number }; imageAnalysis: { basic: number; medium: number; hard: number }; videoAd: { standard: number } };
  video: { minDurationSeconds: number; maxDurationSeconds: number; audio: boolean };
};
type Job = { id: string; status: string; operation: string; prompt: string; size: string; quality: Quality; provider: string | null; model: string | null; output_path?: string | null; error_code: string | null; error_message: string | null; created_at: string; completed_at: string | null; project_id?: string | null; request: Record<string, unknown> };
type Output = { id?: string; variant: 'master' | 'preview'; storage_path: string; mime_type: string; width: number; height: number; byte_size: number; url: string | null };
type AnalysisResult = { classification: 'ai_generated' | 'edited_or_composited' | 'likely_real' | 'inconclusive'; ai_generated_probability: number; edited_probability: number; real_probability: number; inconclusive_probability: number; confidence: number; evidence: string[]; possible_editing_tools: string[]; limitations: string[] };

const modes: Array<{ id: Mode; label: string; description: string; icon: typeof ImagePlus }> = [
  { id: 'image', label: 'Image generation', description: 'Create a production image', icon: ImagePlus },
  { id: 'analysis', label: 'Image authenticity analysis', description: 'Check AI, edits, and real likelihood', icon: ScanSearch },
  { id: 'video', label: 'Silent video generation', description: 'Generate a silent 5s or 10s clip', icon: Video },
];
const platformLabels: Record<PlatformId, string> = { youtube_thumbnail: 'YouTube Thumbnail', instagram_post: 'Instagram Post', instagram_story: 'Instagram Story', facebook_post: 'Facebook Post', facebook_cover: 'Facebook Cover', pinterest_pin: 'Pinterest Pin', linkedin_post: 'LinkedIn Post', x_post: 'X Post', ad_creative: 'Ad Creative', poster: 'Poster', website_banner: 'Website Banner' };

function bytesLabel(bytes: number) { if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`; if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`; return `${bytes} B`; }
function percent(value: number) { return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`; }
function asAnalysis(value: unknown): AnalysisResult | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<AnalysisResult>;
  const classifications = ['ai_generated', 'edited_or_composited', 'likely_real', 'inconclusive'] as const;
  if (!classifications.includes(item.classification as typeof classifications[number])) return null;
  return {
    classification: item.classification as AnalysisResult['classification'],
    ai_generated_probability: typeof item.ai_generated_probability === 'number' ? item.ai_generated_probability : 0,
    edited_probability: typeof item.edited_probability === 'number' ? item.edited_probability : 0,
    real_probability: typeof item.real_probability === 'number' ? item.real_probability : 0,
    inconclusive_probability: typeof item.inconclusive_probability === 'number' ? item.inconclusive_probability : 0,
    confidence: typeof item.confidence === 'number' ? item.confidence : 0,
    evidence: Array.isArray(item.evidence) ? item.evidence.filter((x): x is string => typeof x === 'string') : [],
    possible_editing_tools: Array.isArray(item.possible_editing_tools) ? item.possible_editing_tools.filter((x): x is string => typeof x === 'string') : [],
    limitations: Array.isArray(item.limitations) ? item.limitations.filter((x): x is string => typeof x === 'string') : [],
  };
}
function statusTone(status: string) { return status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : status === 'failed' || status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'; }

export default function MediaStudioPage() {
  const [mode, setMode] = useState<Mode>('image');
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState<PlatformId>('youtube_thumbnail');
  const [quality, setQuality] = useState<Quality>('standard');
  const [reference, setReference] = useState<UploadedReference | null>(null);
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [analysisPreviewUrl, setAnalysisPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>('basic');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [previewOutput, setPreviewOutput] = useState<Output | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spec = PLATFORM_SPECS[platform];
  const active = job?.status === 'queued' || job?.status === 'processing';
  const isVideo = job?.operation === 'generateVideoAd';
  const imageCost = usage?.features.imageGeneration[quality] ?? (quality === 'preview' ? 1 : quality === 'standard' ? 5 : 10);
  const analysisCost = usage?.features.imageAnalysis[analysisLevel] ?? (analysisLevel === 'basic' ? 2 : analysisLevel === 'medium' ? 5 : 10);
  const videoCost = usage ? usage.features.videoAd.standard * Math.max(1, duration / 5) : duration === 5 ? 10 : 20;
  const selectedMode = modes.find(item => item.id === mode) ?? modes[0];
  const available = usage?.credits.available ?? 0;
  const currentCost = mode === 'image' ? imageCost : mode === 'analysis' ? analysisCost : videoCost;
  const canAfford = currentCost > 0 && available >= currentCost;
  const runsRemaining = currentCost > 0 ? Math.floor(available / currentCost) : 0;
  const persistedAnalysisPreview = previewOutput?.url ?? output?.url ?? analysisPreviewUrl;
  const storageComparison = useMemo(() => {
    if (!output) return null;
    if (!previewOutput) return { original: bytesLabel(output.byte_size), preview: null as string | null, ratio: null as string | null };
    const ratio = output.byte_size > 0 ? (previewOutput.byte_size / output.byte_size) * 100 : 0;
    return { original: bytesLabel(output.byte_size), preview: bytesLabel(previewOutput.byte_size), ratio: `${ratio.toFixed(1)}% of original` };
  }, [output, previewOutput]);

  async function loadUsage() {
    setLoadingUsage(true);
    try {
      const response = await fetch('/api/media-usage', { cache: 'no-store' });
      const data = await response.json() as Usage & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load live credit balance.');
      setUsage(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load live credit balance.');
    } finally {
      setLoadingUsage(false);
    }
  }

  async function loadJob(id: string, video = false) {
    try {
      const response = await fetch(`${video ? '/api/video-ad/' : '/api/generate/'}${id}`, { cache: 'no-store' });
      const data = await response.json() as { job?: Job; output?: Output | null; preview?: Output | null; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || 'Unable to read job status.');
      setJob(data.job); setOutput(data.output ?? null); setPreviewOutput(data.preview ?? null);
      if (data.job.operation === 'analyzeImage') setAnalysis(asAnalysis(data.job.request?.analysisResult));
      return data.job.status;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read job status.');
      return null;
    }
  }

  async function loadHistory(id: string) {
    setLoadingHistory(true); setMessage('');
    try {
      const response = await fetch(`/api/history/${id}`, { cache: 'no-store' });
      const data = await response.json() as { job?: Job; output?: Output | null; preview?: Output | null; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || 'Unable to open saved media.');
      const saved = data.job.request ?? {};
      setMode(data.job.operation === 'analyzeImage' ? 'analysis' : data.job.operation === 'generateVideoAd' ? 'video' : 'image');
      setHistoryId(id); setJob(data.job); setOutput(data.output ?? null); setPreviewOutput(data.preview ?? null); setPrompt(data.job.prompt); setAnalysis(asAnalysis(saved.analysisResult));
      if (data.preview?.url && data.job.operation === 'analyzeImage') setAnalysisPreviewUrl(data.preview.url); else if (data.output?.url && data.job.operation === 'analyzeImage') setAnalysisPreviewUrl(data.output.url);
      if (typeof saved.platform === 'string' && saved.platform in PLATFORM_SPECS) setPlatform(saved.platform as PlatformId);
      if (['preview', 'standard', 'premium'].includes(data.job.quality)) setQuality(data.job.quality as Quality);
      if (typeof saved.analysisLevel === 'string' && ['basic', 'medium', 'hard'].includes(saved.analysisLevel)) setAnalysisLevel(saved.analysisLevel as AnalysisLevel);
      if (typeof saved.durationSeconds === 'number') setDuration([5, 10].includes(saved.durationSeconds) ? saved.durationSeconds : 5);
      if (typeof saved.aspectRatio === 'string' && ['16:9', '9:16', '1:1'].includes(saved.aspectRatio)) setAspectRatio(saved.aspectRatio);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open saved media.');
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => { void loadUsage(); const id = new URLSearchParams(window.location.search).get('history'); if (id) void loadHistory(id); }, []);
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); if (reference?.previewUrl) URL.revokeObjectURL(reference.previewUrl); if (analysisPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysisPreviewUrl); }, [reference?.previewUrl, analysisPreviewUrl]);
  useEffect(() => {
    if (!job?.id || !active) return;
    const video = job.operation === 'generateVideoAd';
    let cancelled = false;
    const poll = async () => { const status = await loadJob(job.id, video); if (!cancelled && status && ['queued', 'processing'].includes(status)) pollRef.current = setTimeout(poll, video ? 5000 : 1400); };
    void poll();
    return () => { cancelled = true; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [job?.id, job?.status]);

  function resetResult() { setMessage(''); setJob(null); setOutput(null); setPreviewOutput(null); setHistoryId(null); setAnalysis(null); }
  function chooseMode(next: Mode) { setMode(next); resetResult(); }

  async function submitImage(event: FormEvent) {
    event.preventDefault();
    if (!canAfford) { setMessage(currentCost > 0 ? `You need ${currentCost} credits. You have ${available} available.` : 'This image option is unavailable on the current plan.'); return; }
    setLoading(true); resetResult();
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ operation: 'generateImage', prompt: prompt.trim(), platform, quality, size: `${spec.width}x${spec.height}`, width: spec.width, height: spec.height, referenceImageStoragePaths: reference?.path ? [reference.path] : [] }) });
      const data = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !data.jobId) throw new Error(data.error || 'Image generation could not be started.');
      setJob({ id: data.jobId, status: 'queued', operation: 'generateImage', prompt: prompt.trim(), size: `${spec.width}x${spec.height}`, quality, provider: null, model: null, error_code: null, error_message: null, created_at: new Date().toISOString(), completed_at: null, request: { platform, quality } });
      await loadJob(data.jobId); setMessage(`Queued · ${imageCost} credit${imageCost === 1 ? '' : 's'} reserved.`); void loadUsage();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Image generation failed.'); } finally { setLoading(false); }
  }

  async function submitAnalysis() {
    if (!analysisFile) { setMessage('Choose an image to analyze.'); return; }
    if (!canAfford) { setMessage(currentCost > 0 ? `You need ${currentCost} credits. You have ${available} available.` : 'This analysis level is unavailable on the current plan.'); return; }
    setLoading(true); resetResult();
    try {
      const form = new FormData(); form.append('image', analysisFile); form.append('level', analysisLevel);
      const response = await fetch('/api/analyze-image', { method: 'POST', body: form });
      const data = await response.json() as { result?: unknown; jobId?: string; output?: Output; preview?: Output; error?: string };
      if (!response.ok || !data.result) throw new Error(data.error || 'Image analysis failed.');
      const parsed = asAnalysis(data.result); if (!parsed) throw new Error('The analysis response could not be normalized.');
      setAnalysis(parsed); setOutput(data.output ?? null); setPreviewOutput(data.preview ?? null); setAnalysisPreviewUrl(data.preview?.url ?? data.output?.url ?? null);
      if (data.jobId) { setHistoryId(data.jobId); setJob({ id: data.jobId, status: 'succeeded', operation: 'analyzeImage', prompt: `Image authenticity analysis · ${analysisLevel}`, size: data.output ? `${data.output.width}x${data.output.height}` : '', quality: 'preview', provider: 'google', model: null, error_code: null, error_message: null, created_at: new Date().toISOString(), completed_at: new Date().toISOString(), request: { analysisResult: parsed, analysisLevel } }); }
      setMessage(`Analysis complete · ${analysisCost} credit${analysisCost === 1 ? '' : 's'} used.`); void loadUsage();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Image analysis failed.'); } finally { setLoading(false); }
  }

  async function submitVideo() {
    if (prompt.trim().length < 3) { setMessage('Describe the product, scene, movement, camera, and constraints.'); return; }
    if (!canAfford) { setMessage(`You need ${videoCost} credits. You have ${available} available.`); return; }
    setLoading(true); resetResult();
    try {
      const response = await fetch('/api/video-ad', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ prompt: prompt.trim(), durationSeconds: duration, quality: 'standard', aspectRatio }) });
      const data = await response.json() as { jobId?: string; error?: string; model?: string; provider?: string };
      if (!response.ok || !data.jobId) throw new Error(data.error || 'Video generation could not be started.');
      setJob({ id: data.jobId, status: 'queued', operation: 'generateVideoAd', prompt: prompt.trim(), size: aspectRatio, quality: 'standard', provider: data.provider ?? null, model: data.model ?? null, error_code: null, error_message: null, created_at: new Date().toISOString(), completed_at: null, request: { durationSeconds: duration, videoQuality: 'standard', aspectRatio } });
      await loadJob(data.jobId, true); setMessage(`Queued · ${videoCost} credits reserved.`); void loadUsage();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Video generation failed.'); } finally { setLoading(false); }
  }

  async function downloadCurrent() {
    if (!historyId) return; setDownloading(true);
    try {
      const response = await fetch(`/api/history/${historyId}/download`, { cache: 'no-store' });
      if (!response.ok) { const data = await response.json().catch(() => ({})) as { error?: string }; throw new Error(data.error || 'Download failed.'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `solamentis-${historyId}${isVideo ? '.mp4' : output?.mime_type === 'image/jpeg' ? '.jpg' : output?.mime_type === 'image/png' ? '.png' : '.webp'}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Download failed.'); } finally { setDownloading(false); }
  }
  async function deleteCurrent() { if (!historyId || !window.confirm('Delete this history item and its stored assets?')) return; const response = await fetch(`/api/history/${historyId}`, { method: 'DELETE' }); const data = await response.json() as { error?: string }; if (!response.ok) { setMessage(data.error || 'Unable to delete.'); return; } window.location.href = '/dashboard/history'; }
  function onAnalysisFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0] ?? null; setAnalysisFile(file); setAnalysis(null); setOutput(null); setPreviewOutput(null); setHistoryId(null); setMessage(''); if (analysisPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysisPreviewUrl); setAnalysisPreviewUrl(file ? URL.createObjectURL(file) : null); }

  return <div className="space-y-7 sm:space-y-8">
    <header><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">AI Media Studio</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Create, analyze, and review everything in one place.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Choose one tool from the selector. Every option shows the exact credits that will be charged before you start.</p></div><div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">Available now</p><p className="mt-1 text-lg font-bold text-slate-950">{loadingUsage ? '…' : available.toLocaleString()} credits</p>{usage && <p className="mt-1 text-xs text-slate-500">{usage.credits.monthlyRemaining} monthly · {usage.credits.addon} purchased · {usage.credits.reserved} reserved</p>}</div></div></header>

    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-slate-400">Tool</p><p className="mt-1 text-sm font-semibold text-slate-950">Select what you want to do</p></div><div className="min-w-0 flex-1 sm:max-w-xl"><select value={mode} onChange={event => chooseMode(event.target.value as Mode)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"><option value="image">Image generation</option><option value="analysis">Image authenticity analysis</option><option value="video">Silent video generation</option></select></div><div className="hidden items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold text-white sm:flex"><Coins className="size-4 text-slate-300" />{currentCost > 0 ? `${currentCost} credit${currentCost === 1 ? '' : 's'} per run` : 'Unavailable on this plan'}</div></div><div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs"><span className="font-medium text-slate-500">{selectedMode.description}</span><span className={`${canAfford ? 'text-emerald-700' : 'text-amber-700'} font-semibold`}>{currentCost > 0 ? `${runsRemaining} run${runsRemaining === 1 ? '' : 's'} possible with your balance` : 'Not available on current plan'}</span></div></section>

    {mode === 'image' && <form onSubmit={submitImage} className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]"><section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-lg font-semibold">Generate an image</h2><p className="mt-1 text-sm text-slate-500">Platform changes output dimensions. Quality controls the credit cost.</p></div><label className="block text-sm font-medium text-slate-800">Platform<select value={platform} onChange={event => setPlatform(event.target.value as PlatformId)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{Object.entries(platformLabels).map(([id, label]) => <option key={id} value={id}>{label} · {PLATFORM_SPECS[id as PlatformId].width}×{PLATFORM_SPECS[id as PlatformId].height}</option>)}</select><span className="mt-1.5 block text-xs text-slate-400">Platform selection does not change the credit charge.</span></label><div><p className="text-sm font-medium text-slate-800">Quality · credit cost</p><div className="mt-2 grid grid-cols-3 gap-2">{(['preview','standard','premium'] as Quality[]).map(value => { const cost = usage?.features.imageGeneration[value] ?? (value === 'preview' ? 1 : value === 'standard' ? 5 : 10); const selected = quality === value; return <button key={value} type="button" onClick={() => setQuality(value)} className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-slate-950 bg-slate-950 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><p className="text-xs font-semibold capitalize">{value}</p><p className={`mt-1 text-lg font-bold ${selected ? 'text-white' : 'text-slate-950'}`}>{cost}</p><p className={`text-[11px] ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{cost === 1 ? 'credit' : 'credits'}</p></button>; })}</div></div><label className="block text-sm font-medium text-slate-800">Prompt<textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={7} required minLength={3} placeholder="Describe the subject, composition, lighting, style, text placement, and constraints…" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"/></label><ImageUpload current={reference} onChange={setReference}/><CreditSummary cost={imageCost} available={available} label="This image"/><button type="submit" disabled={loading || loadingUsage || !canAfford} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}{loading ? 'Starting…' : `Generate image · ${imageCost} credits`}</button>{message && <p className="text-sm font-medium text-slate-600" role="status">{message}</p>}</section><ResultPanel job={job} output={output} previewOutput={previewOutput} message={message} loadingHistory={loadingHistory} onDownload={downloadCurrent} onDelete={deleteCurrent} downloading={downloading} isVideo={false}/></form>}

    {mode === 'analysis' && <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-lg font-semibold">Image authenticity analysis</h2><p className="mt-1 text-sm leading-6 text-slate-500">Choose the analysis depth below. Higher levels use more credits.</p></div><label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center hover:border-slate-400"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff" hidden onChange={onAnalysisFile}/><UploadCloud className="size-7 text-slate-500"/><span className="mt-3 text-sm font-semibold text-slate-800">Choose image to analyze</span><span className="mt-1 text-xs text-slate-500">JPG, PNG, WebP, GIF, BMP, TIFF · max 25 MB</span></label>{analysisFile && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex gap-4"><div className="size-24 overflow-hidden rounded-xl bg-slate-950"><img src={analysisPreviewUrl ?? undefined} alt="Uploaded image preview" className="h-full w-full object-contain"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{analysisFile.name}</p><p className="mt-1 text-xs text-slate-500">{bytesLabel(analysisFile.size)} · SHA-256 saved with history</p></div></div></div>}<div><p className="text-sm font-medium text-slate-800">Analysis type · credit cost</p><div className="mt-2 grid grid-cols-3 gap-2">{(['basic','medium','hard'] as AnalysisLevel[]).map(value => { const cost = usage?.features.imageAnalysis[value] ?? (value === 'basic' ? 2 : value === 'medium' ? 5 : 10); const selected = analysisLevel === value; const locked = cost <= 0; return <button key={value} type="button" disabled={locked} onClick={() => setAnalysisLevel(value)} className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-slate-950 bg-slate-950 text-white' : locked ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><p className="text-xs font-semibold capitalize">{value}</p><p className={`mt-1 text-lg font-bold ${selected ? 'text-white' : 'text-slate-950'}`}>{locked ? '—' : cost}</p><p className={`text-[11px] ${selected ? 'text-slate-300' : locked ? 'text-slate-400' : 'text-slate-500'}`}>{locked ? 'Plan unavailable' : cost === 1 ? 'credit' : 'credits'}</p></button>; })}</div></div><CreditSummary cost={analysisCost} available={available} label="This analysis"/><button type="button" disabled={loading || loadingUsage || !analysisFile || !canAfford} onClick={() => void submitAnalysis()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin"/> : <ScanSearch className="size-4"/>}{loading ? 'Analyzing…' : `Analyze image · ${analysisCost} credits`}</button>{message && <p className="text-sm font-medium text-slate-600" role="status">{message}</p>}</section><AnalysisResultPanel analysis={analysis} persistedPreview={persistedAnalysisPreview} storageComparison={storageComparison}/></div>}

    {mode === 'video' && <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]"><section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-lg font-semibold">Generate a silent video</h2><p className="mt-1 text-sm text-slate-500">Silent output only. Duration controls the credit cost; aspect ratio changes framing, not price.</p></div><label className="block text-sm font-medium text-slate-800">Prompt<textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={7} required minLength={3} placeholder="Describe product, scene, camera movement, pacing, and constraints…" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"/></label><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm font-medium text-slate-800">Duration · credit cost</p><div className="mt-2 grid grid-cols-2 gap-2">{[5,10].map(value => { const cost = (usage?.features.videoAd.standard ?? 10) * (value / 5); const selected = duration === value; return <button key={value} type="button" onClick={() => setDuration(value)} className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-slate-950 bg-slate-950 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><p className="text-xs font-semibold">{value} seconds</p><p className={`mt-1 text-lg font-bold ${selected ? 'text-white' : 'text-slate-950'}`}>{cost}</p><p className={`text-[11px] ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{cost === 1 ? 'credit' : 'credits'}</p></button>; })}</div></div><div><p className="text-sm font-medium text-slate-800">Aspect ratio</p><div className="mt-2 grid grid-cols-3 gap-2">{['16:9','9:16','1:1'].map(value => <button key={value} type="button" onClick={() => setAspectRatio(value)} className={`rounded-2xl border p-3 text-center transition ${aspectRatio === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><p className="text-sm font-bold">{value}</p><p className={`mt-1 text-[11px] ${aspectRatio === value ? 'text-slate-300' : 'text-slate-500'}`}>same cost</p></button>)}</div></div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-4 text-sm"><span className="font-medium text-slate-600">Selected video</span><strong className="text-slate-950">{duration}s · {aspectRatio}</strong></div><div className="mt-2 flex items-center justify-between gap-4"><span className="text-xs text-slate-500">Silent · Standard · 720p</span><span className="text-base font-bold text-slate-950">{videoCost} credits</span></div><p className="mt-2 text-xs leading-5 text-slate-500">Your balance: {available} credits. Aspect ratio does not change the charge.</p></div><button type="button" disabled={loading || loadingUsage || !canAfford} onClick={() => void submitVideo()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin"/> : <Video className="size-4"/>}{loading ? 'Starting…' : `Generate video · ${videoCost} credits`}</button>{message && <p className="text-sm font-medium text-slate-600" role="status">{message}</p>}</section><ResultPanel job={job} output={output} previewOutput={previewOutput} message={message} loadingHistory={loadingHistory} onDownload={downloadCurrent} onDelete={deleteCurrent} downloading={downloading} isVideo={isVideo}/></div>}
  </div>;
}

function CreditSummary({ cost, available, label }: { cost: number; available: number; label: string }) { const affordable = cost > 0 && available >= cost; return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Credit check</p><p className="mt-1 text-sm font-semibold text-slate-950">{label}: {cost} {cost === 1 ? 'credit' : 'credits'}</p></div><div className={`rounded-full px-3 py-1 text-xs font-bold ${affordable ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{affordable ? `${available - cost} left after run` : `Need ${Math.max(0, cost - available)} more`}</div></div></div>; }
function AnalysisResultPanel({ analysis, persistedPreview, storageComparison }: { analysis: AnalysisResult | null; persistedPreview: string | null; storageComparison: { original: string; preview: string | null; ratio: string | null } | null }) {
  return <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{analysis ? <><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Result</p><h2 className="mt-2 text-xl font-semibold capitalize">{analysis.classification.replaceAll('_', ' ')}</h2><p className="mt-1 text-sm text-slate-500">Confidence {percent(analysis.confidence)} · percentages are model estimates, not certainty.</p></div>{persistedPreview && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950"><img src={persistedPreview} alt="Analyzed image" className="max-h-[520px] w-full object-contain"/></div>}{storageComparison && <div className="grid gap-3 sm:grid-cols-3"><Metric label="Original" value={storageComparison.original}/><Metric label="Compressed preview" value={storageComparison.preview ?? 'Not created'}/><Metric label="Preview size" value={storageComparison.ratio ?? '—'}/></div>}<div className="grid gap-3 sm:grid-cols-2"><ProbabilityCard label="AI-generated" value={analysis.ai_generated_probability}/><ProbabilityCard label="Edited / composited" value={analysis.edited_probability}/><ProbabilityCard label="Likely real" value={analysis.real_probability}/><ProbabilityCard label="Inconclusive" value={analysis.inconclusive_probability}/></div><div className="grid gap-3 sm:grid-cols-2"><Metric label="Confidence" value={percent(analysis.confidence)}/><Metric label="Conclusion" value={analysis.classification.replaceAll('_', ' ')}/></div><ResultList title="Evidence" items={analysis.evidence}/><ResultList title="Possible editing tools" items={analysis.possible_editing_tools} empty="None identified from the returned evidence."/><ResultList title="Limitations" items={analysis.limitations}/></> : <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><div><FileSearch className="mx-auto size-10 text-slate-400"/><h3 className="mt-4 text-base font-semibold text-slate-800">Analysis result will appear here</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Choose an analysis level above, then the returned authenticity breakdown will appear here.</p></div></div>}</section>;
}
function ProbabilityCard({ label, value }: { label: string; value: number }) { const pct = Math.max(0, Math.min(1, value)); return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{label}</p><p className="text-lg font-bold text-slate-950">{percent(pct)}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${pct * 100}%` }}/></div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>; }
function ResultList({ title, items, empty = 'No returned items.' }: { title: string; items: string[]; empty?: string }) { return <div><h3 className="text-sm font-semibold text-slate-900">{title}</h3><div className="mt-2 space-y-2">{items.length ? items.map((item,index) => <div key={`${item}-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-600">{item}</div>) : <p className="text-sm text-slate-400">{empty}</p>}</div></div>; }
function ResultPanel({ job, output, previewOutput, message, loadingHistory, onDownload, onDelete, downloading, isVideo }: { job: Job | null; output: Output | null; previewOutput: Output | null; message: string; loadingHistory: boolean; onDownload: () => Promise<void>; onDelete: () => Promise<void>; downloading: boolean; isVideo: boolean }) {
  const active = job?.status === 'queued' || job?.status === 'processing';
  return <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{loadingHistory && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin"/>Opening saved history…</div>}{!job && !loadingHistory && <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center"><div><Clock3 className="mx-auto size-9 text-slate-400"/><p className="mt-3 text-sm font-semibold text-slate-700">Your result will appear here</p><p className="mt-1 text-xs text-slate-500">Generation status and saved outputs will appear here.</p></div></div>}{job && <><div className="flex items-center justify-between gap-3"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${statusTone(job.status)}`}>{job.status === 'succeeded' ? <CheckCircle2 className="size-3.5"/> : active ? <Loader2 className="size-3.5 animate-spin"/> : <XCircle className="size-3.5"/>}{job.status}</span><span className="text-xs text-slate-400">{job.provider && job.model ? `${job.provider} · ${job.model}` : 'Provider-managed'}</span></div>{output?.url && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">{isVideo ? <video src={output.url} controls muted playsInline className="max-h-[520px] w-full object-contain"/> : <img src={(previewOutput?.url ?? output.url)} alt="Saved generated output" className="max-h-[520px] w-full object-contain"/>}</div>}{job.operation !== 'analyzeImage' && <div className="grid grid-cols-2 gap-3"><Metric label="Master" value={output ? bytesLabel(output.byte_size) : '—'}/><Metric label="Preview" value={previewOutput ? bytesLabel(previewOutput.byte_size) : isVideo ? 'Video master' : '—'}/></div>}<p className="text-sm leading-6 text-slate-600">{message || (active ? 'Processing…' : job.status === 'succeeded' ? 'Saved successfully to private storage and history.' : job.error_message || 'The operation did not complete.')}</p>{job.status === 'succeeded' && <div className="flex flex-wrap gap-2"><button type="button" disabled={downloading || !output} onClick={() => void onDownload()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"><Download className="size-4"/>{downloading ? 'Preparing…' : 'Download master'}</button><button type="button" onClick={() => void onDelete()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600"><Trash2 className="size-4"/>Delete</button></div>}</>}</section>;
}
