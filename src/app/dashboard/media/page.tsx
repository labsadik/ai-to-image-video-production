'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CircleHelp, FileSearch, ImagePlus, Loader2, Sparkles, Video } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageUpload, type UploadedReference } from '@/components/image-upload';

const examples = {
  image: { bad: 'A nice car', good: 'Luxury black sports car outside a glass villa at sunset, cinematic lighting, realistic reflections, premium automotive advertising photography, 16:9.', super: 'Subject: luxury black sports car. Environment: modern glass villa at golden hour. Lighting: warm sunset rim light plus soft studio fill. Camera: low 35mm automotive commercial look. Composition: hero product centered with negative space for headline. Materials: glossy paint, realistic reflections. Mood: premium, elegant, high-end. Constraints: no people, no logos, clean background.' },
  video: { bad: 'Make an ad for shoes', good: 'Create an 8-second premium running-shoe advertisement. Show the shoe rotating slowly above a wet reflective studio floor, dramatic soft lighting, close product details, clean background, cinematic commercial motion, no people, no text, no audio.', super: 'Product: premium white running shoe. Duration: 8 seconds. Scene: dark luxury studio with reflective wet floor. Action: shoe enters frame, rotates 180 degrees, camera pushes in, final hero angle holds for 1 second. Camera: controlled commercial dolly plus macro detail. Lighting: soft key, subtle rim, polished reflections. Motion: smooth and physically plausible. Mood: premium athletic performance. Constraints: no people, no text, no logos, no audio.' },
  analysis: { bad: 'Is this AI?', good: 'Analyze this image for likely AI generation, digital manipulation, compositing, camera-original characteristics, metadata/provenance clues, compression artifacts, and visual inconsistencies. Return confidence and evidence.', super: 'Perform a deep forensic authenticity analysis. Estimate AI-generation likelihood, editing/manipulation likelihood, camera-original likelihood, and confidence. Examine texture/frequency anomalies, local detail consistency, resampling/compression clues, metadata when available, compositing indicators, and signs associated with AI image pipelines. Return evidence, uncertainty, and limitations. Do not claim certainty.' }
} as const;

type AnalysisLevel = 'basic' | 'medium' | 'hard';
type VideoQuality = 'standard' | 'high_end';

export default function MediaStudioPage() {
  const [tab, setTab] = useState<'image' | 'analysis' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [imageQuality, setImageQuality] = useState('standard');
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>('basic');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [reference, setReference] = useState<UploadedReference | null>(null);
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(8);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('standard');
  const [helpOpen, setHelpOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  async function pollJob(id: string, video = false) {
    const status = await fetch(`${video ? '/api/video-ad/' : '/api/generate/'}${id}`, { cache: 'no-store' }).then(r => r.json()) as { job?: { status: string; error_message?: string | null }; output?: { url?: string | null } | null };
    if (status.job?.status === 'succeeded' && status.output?.url) { setResult(status.output.url); setMessage('Ready.'); setLoading(false); return; }
    if (status.job?.status === 'failed' || status.job?.status === 'cancelled') { setMessage(status.job.error_message || 'Generation failed.'); setLoading(false); return; }
    pollRef.current = setTimeout(() => void pollJob(id, video), video ? 5000 : 1800);
  }

  async function submitImage() {
    setLoading(true); setMessage(''); setResult(null);
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ operation: 'generateImage', prompt: prompt.trim(), platform: 'ad_creative', quality: imageQuality === 'premium' ? 'premium' : imageQuality === 'standard' ? 'standard' : 'preview', width: 1024, height: 1024, size: '1024x1024', referenceImageStoragePaths: reference?.path ? [reference.path] : [] }) });
      const data = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !data.jobId) throw new Error(data.error || 'Image generation could not be started.');
      await pollJob(data.jobId);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Image generation failed.'); setLoading(false); }
  }

  async function submitAnalysis() {
    if (!analysisFile) { setMessage('Choose an image to analyze. This file is sent directly to the analyzer and is not passed through the generation upload safety gate.'); return; }
    setLoading(true); setMessage(''); setAnalysis(null);
    try {
      const form = new FormData(); form.append('image', analysisFile); form.append('level', analysisLevel);
      const response = await fetch('/api/analyze-image', { method: 'POST', body: form });
      const data = await response.json() as { result?: Record<string, unknown>; error?: string };
      if (!response.ok || !data.result) throw new Error(data.error || 'Image analysis failed.');
      setAnalysis(data.result); setMessage('Analysis complete.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Image analysis failed.'); }
    finally { setLoading(false); }
  }

  async function submitVideo() {
    setLoading(true); setMessage(''); setResult(null);
    try {
      const response = await fetch('/api/video-ad', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ prompt: prompt.trim(), durationSeconds: duration, quality: videoQuality, aspectRatio: '16:9' }) });
      const data = await response.json() as { jobId?: string; error?: string; model?: string };
      if (!response.ok || !data.jobId) throw new Error(data.error || 'Video ad could not be started.');
      setMessage(`Queued · OpenRouter test model ${data.model ?? ''}`); await pollJob(data.jobId, true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Video generation failed.'); setLoading(false); }
  }

  const example = examples[tab];
  return <div className="space-y-6 sm:space-y-8">
    <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">AI Studio</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Create, analyze, and test media.</h1><button type="button" onClick={() => setHelpOpen(true)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950"><CircleHelp className="size-4"/> Your prompt matters — better prompts produce better results.</button></div><div className="rounded-xl bg-slate-950 px-4 py-3 text-xs font-medium text-white">OpenRouter test mode · one server API key</div></section>
    <div className="grid grid-cols-3 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">{([['image', ImagePlus, 'Image generation'], ['analysis', FileSearch, 'Image analysis'], ['video', Video, 'Video ad']] as const).map(([id, Icon, label]) => <button key={id} type="button" onClick={() => { setTab(id); setMessage(''); setAnalysis(null); setResult(null); }} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold sm:text-sm ${tab===id?'bg-slate-950 text-white':'text-slate-500 hover:bg-slate-50'}`}><Icon className="size-4"/>{label}</button>)}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]"><Card><CardHeader><div className="flex items-center gap-3">{tab==='image'?<Sparkles className="size-5"/>:tab==='analysis'?<Camera className="size-5"/>:<Video className="size-5"/>}<div><p className="text-sm font-semibold">{tab==='image'?'Image generation':tab==='analysis'?'Image authenticity analysis':'Silent video ad generation'}</p><p className="text-xs text-slate-400">Existing plans, credits, provider routing, and safety rules remain authoritative.</p></div></div></CardHeader><CardBody className="space-y-5">
      {tab==='image'&&<><ImageUpload current={reference} onChange={setReference}/><label className="block text-sm font-medium">Quality<select value={imageQuality} onChange={e=>setImageQuality(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-3"><option value="preview">Preview · existing plan pricing</option><option value="standard">Standard · existing plan pricing</option><option value="premium">Premium · existing plan pricing</option></select></label></>}
      {tab==='analysis'&&<><label className="block text-sm font-medium">Image file<input type="file" accept="image/*" onChange={e=>setAnalysisFile(e.target.files?.[0]??null)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"/></label><label className="block text-sm font-medium">Analysis depth<select value={analysisLevel} onChange={e=>setAnalysisLevel(e.target.value as AnalysisLevel)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-3"><option value="basic">Basic · 2 credits</option><option value="medium">Medium · 5 credits</option><option value="hard">Hard · 12 credits</option></select></label><p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Image analysis does not use the generation safety filter. It accepts any image for forensic analysis.</p></>}
      {tab==='video'&&<div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Duration<select value={duration} onChange={e=>setDuration(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-3">{[3,4,5,6,8,10,12,15,20,30].map(v=><option key={v} value={v}>{v} seconds</option>)}</select></label><label className="block text-sm font-medium">Quality<select value={videoQuality} onChange={e=>setVideoQuality(e.target.value as VideoQuality)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-3"><option value="standard">Standard Ad · 9 credits</option><option value="high_end">High-End Ad · 25 credits</option></select></label></div>}
      {tab!=='analysis'&&<label className="block text-sm font-medium">Prompt<textarea required minLength={3} rows={9} value={prompt} onChange={e=>setPrompt(e.target.value)} className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3.5 leading-6" placeholder={tab==='video'?'Describe product, motion, camera, scene, lighting, timing, and constraints.':'Describe subject, composition, lighting, style, and constraints.'}/></label>}
      {message&&<div role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</div>}
      <Button type="button" disabled={loading || (tab!=='analysis'&&prompt.trim().length<3)} loading={loading} className="w-full" onClick={() => void (tab==='image'?submitImage():tab==='analysis'?submitAnalysis():submitVideo())}>{loading?'Working…':tab==='image'?'Generate image':tab==='analysis'?'Analyze image':`Generate ${duration}s video ad`}</Button>
    </CardBody></Card>
    <Card><CardHeader><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Result</p></CardHeader><CardBody>{result&&tab==='image'&&<img src={result} alt="Generated image" className="w-full rounded-2xl border border-slate-200 object-contain"/>}{result&&tab==='video'&&<video src={result} controls playsInline className="w-full rounded-2xl border border-slate-200"/>}{analysis&&<pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-white">{JSON.stringify(analysis,null,2)}</pre>}{!result&&!analysis&&<div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div><Loader2 className={`mx-auto size-8 text-slate-300 ${loading?'animate-spin':''}`}/><p className="mt-3 text-sm font-semibold text-slate-600">Your result appears here</p></div></div>}</CardBody></Card></div>
    {helpOpen&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onMouseDown={()=>setHelpOpen(false)}><div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl" onMouseDown={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Prompt examples</h2><p className="mt-1 text-sm text-slate-500">Better prompts give the model more useful instructions.</p></div><button type="button" onClick={()=>setHelpOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">Close</button></div><div className="mt-6 space-y-4"><Example title="Bad prompt" value={example.bad}/><Example title="Good prompt" value={example.good}/><Example title="Super prompt" value={example.super}/></div></div></div>}
  </div>;
}

function Example({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">{title}</p><p className="mt-2 text-sm leading-6 text-slate-700">{value}</p></div>; }
