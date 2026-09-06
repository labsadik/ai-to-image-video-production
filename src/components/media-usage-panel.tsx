'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Calculator, CheckCircle2, ImageIcon, RefreshCw, UploadCloud, Video, X } from 'lucide-react';

type Usage = {
  plan: 'free' | 'pro' | 'business';
  credits: { monthly: number; used: number; reserved: number; available: number };
  uploads: { total: number; maxPerProject: number; note: string };
  features: {
    imageGeneration: { preview: number; standard: number; premium: number };
    imageAnalysis: { basic: number; medium: number; hard: number };
    videoAd: { standard: number; high_end: number };
  };
  video: { minDurationSeconds: number; maxDurationSeconds: number; audio: boolean };
};

type Props = { className?: string };

function actionCount(credits: number, cost: number) { return cost > 0 ? Math.floor(credits / cost) : 0; }
function costLabel(cost: number) { return cost > 0 ? `${cost} credit${cost === 1 ? '' : 's'}` : 'Not available on this plan'; }
function bytesLike(value: number) { return Math.max(0, Number.isFinite(value) ? value : 0); }

export function MediaUsagePanel({ className = '' }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadUsage(showSpinner = false) {
    if (showSpinner) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch('/api/media-usage', { cache: 'no-store' });
      const data = await response.json() as Usage & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load live usage.');
      setUsage(data);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load live usage.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadUsage();
    const timer = window.setInterval(() => void loadUsage(), 15000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  const maxCost = useMemo(() => usage ? Math.max(
    usage.features.imageGeneration.preview,
    usage.features.imageGeneration.standard,
    usage.features.imageGeneration.premium,
    usage.features.imageAnalysis.basic,
    usage.features.imageAnalysis.medium,
    usage.features.imageAnalysis.hard,
    usage.features.videoAd.standard,
    usage.features.videoAd.high_end,
  ) : 0, [usage]);

  function openUsage() {
    setOpen(true);
    if (!usage) void loadUsage();
  }

  return <>
    <button
      type="button"
      onClick={openUsage}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 ${className}`}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <Calculator className="size-4" />
      Usage
      {usage && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{usage.credits.available}</span>}
    </button>

    {open && <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50" role="dialog" aria-modal="true" aria-labelledby="media-usage-title">
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="mx-auto flex min-h-20 w-full max-w-[1500px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Calculator className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">Live usage</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h2 id="media-usage-title" className="text-xl font-semibold tracking-tight text-slate-950">Credits, uploads & feature costs</h2>
                {usage && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">{usage.plan} plan</span>}
              </div>
            </div>
            <button type="button" onClick={() => void loadUsage(true)} disabled={refreshing || loading} className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:inline-flex"><RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
            <button type="button" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-950" aria-label="Close usage"><X className="size-5" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
            {!usage && loading ? <div className="space-y-5"><div className="h-32 animate-pulse rounded-3xl bg-white" /><div className="grid gap-5 lg:grid-cols-3"><div className="h-96 animate-pulse rounded-3xl bg-white" /><div className="h-96 animate-pulse rounded-3xl bg-white" /><div className="h-96 animate-pulse rounded-3xl bg-white" /></div></div> : usage && <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard dark label="Available now" value={usage.credits.available} detail={`of ${usage.credits.monthly} monthly credits`} />
                <SummaryCard label="Used" value={usage.credits.used} detail={`${usage.credits.monthly > 0 ? Math.min(100, Math.round((usage.credits.used / usage.credits.monthly) * 100)) : 0}% of monthly allowance`} />
                <SummaryCard label="Reserved" value={usage.credits.reserved} detail="Temporarily held by active jobs" />
                <SummaryCard label="Uploads" value={usage.uploads.total} detail={`${usage.uploads.maxPerProject} max per project`} />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Monthly credit usage</span><span>{usage.credits.used} / {usage.credits.monthly}</span></div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${usage.credits.monthly > 0 ? Math.min(100, Math.round((usage.credits.used / usage.credits.monthly) * 100)) : 0}%` }} /></div>
                <p className="mt-3 text-xs leading-5 text-slate-500">Available means credits you can spend right now. Reserved credits are already held by active jobs and are not counted as available.</p>
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <FeatureCard icon={<ImageIcon className="size-5" />} title="Image generation" subtitle="Your cost and how many more runs you can make now.">
                  {[
                    ['Preview', usage.features.imageGeneration.preview],
                    ['Standard', usage.features.imageGeneration.standard],
                    ['Premium', usage.features.imageGeneration.premium],
                  ].map(([label, cost]) => <CostRow key={label} label={label} cost={bytesLike(cost)} available={usage.credits.available} maxCost={maxCost} />)}
                </FeatureCard>
                <FeatureCard icon={<Calculator className="size-5" />} title="Image authenticity analysis" subtitle="Basic, medium and hard analysis levels use different credit amounts.">
                  {[
                    ['Basic', usage.features.imageAnalysis.basic],
                    ['Medium', usage.features.imageAnalysis.medium],
                    ['Hard', usage.features.imageAnalysis.hard],
                  ].map(([label, cost]) => <CostRow key={label} label={label} cost={bytesLike(cost)} available={usage.credits.available} maxCost={maxCost} />)}
                </FeatureCard>
                <FeatureCard icon={<Video className="size-5" />} title="Video generation" subtitle={`${usage.video.minDurationSeconds}–${usage.video.maxDurationSeconds}s · ${usage.video.audio ? 'audio on' : 'silent output'}`}>
                  {[
                    ['Standard · 720p', usage.features.videoAd.standard],
                    ['High-End · 1080p', usage.features.videoAd.high_end],
                  ].map(([label, cost]) => <CostRow key={label} label={label} cost={bytesLike(cost)} available={usage.credits.available} maxCost={maxCost} />)}
                </FeatureCard>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><UploadCloud className="size-5" /></span><div><p className="text-sm font-semibold text-slate-950">Upload limits</p><p className="text-xs text-slate-500">Live count from your workspace</p></div></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active uploads</p><p className="mt-1 text-2xl font-semibold text-slate-950">{usage.uploads.total}</p><p className="mt-1 text-xs text-slate-500">Across this workspace</p></div>
                    <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Per project</p><p className="mt-1 text-2xl font-semibold text-slate-950">{usage.uploads.maxPerProject}</p><p className="mt-1 text-xs text-slate-500">Maximum allowed</p></div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{usage.uploads.note}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-5" /></span><div><p className="text-sm font-semibold text-slate-950">How the calculator works</p><p className="text-xs text-slate-500">Simple, live math before you run a feature</p></div></div>
                  <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
                    <p><strong className="text-slate-950">Cost</strong> = the credits removed when that feature completes successfully.</p>
                    <p><strong className="text-slate-950">More now</strong> = floor(available credits ÷ feature cost).</p>
                    <p><strong className="text-slate-950">After 1 run</strong> = available credits − feature cost.</p>
                  </div>
                </div>
              </div>
            </>}
          </div>
        </div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Live usage refreshes automatically every 15 seconds while this window is open.</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">Back to Studio</button>
          </div>
        </footer>
      </section>
    </div>}
  </>;
}

function SummaryCard({ label, value, detail, dark = false }: { label: string; value: number; detail: string; dark?: boolean }) {
  return <div className={`rounded-3xl border p-5 ${dark ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white'}`}>
    <p className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-400'}`}>{label}</p>
    <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
    <p className={`mt-2 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{detail}</p>
  </div>;
}

function FeatureCard({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span><div><p className="text-base font-semibold text-slate-950">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div></div><div className="mt-5 space-y-3">{children}</div></section>;
}

function CostRow({ label, cost, available, maxCost }: { label: string; cost: number; available: number; maxCost: number }) {
  const count = actionCount(available, cost);
  const unavailable = cost <= 0;
  const affordable = !unavailable && available >= cost;
  const after = Math.max(0, available - cost);
  const fill = maxCost > 0 && cost > 0 ? Math.min(100, Math.max(6, (cost / maxCost) * 100)) : 0;
  return <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{label}</p><p className={`mt-1 text-xs ${unavailable ? 'text-slate-400' : affordable ? 'text-emerald-600' : 'text-amber-600'}`}>{costLabel(cost)}</p></div><div className="text-right"><p className="text-lg font-bold text-slate-950">{unavailable ? '—' : cost}</p>{!unavailable && <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">credits</p>}</div></div>
    {!unavailable && <>
      <div className="mt-4 flex items-center justify-between gap-3"><span className={`text-xs font-semibold ${affordable ? 'text-emerald-700' : 'text-amber-700'}`}>{count} more now</span><span className="text-xs font-medium text-slate-500">After 1 run: {after}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-900" style={{ width: `${fill}%` }} /></div>
    </>}
  </div>;
}
