'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, ImageIcon, RefreshCw, UploadCloud, Video } from 'lucide-react';

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

function moneyNumber(value: number) { return Number.isFinite(value) ? value : 0; }
function actionCount(credits: number, cost: number) { return cost > 0 ? Math.floor(credits / cost) : 0; }
function costLabel(cost: number) { return cost > 0 ? `${cost} credit${cost === 1 ? '' : 's'}` : 'Not available'; }

export function MediaUsagePanel({ className = '' }: Props) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadUsage(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    try {
      const response = await fetch('/api/media-usage', { cache: 'no-store' });
      const data = await response.json() as Usage & { error?: string };
      if (response.ok) setUsage(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadUsage();
    const timer = window.setInterval(() => void loadUsage(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const maxCost = useMemo(() => {
    if (!usage) return 0;
    return Math.max(usage.features.imageGeneration.preview, usage.features.imageGeneration.standard, usage.features.imageGeneration.premium, usage.features.imageAnalysis.basic, usage.features.imageAnalysis.medium, usage.features.imageAnalysis.hard, usage.features.videoAd.standard, usage.features.videoAd.high_end);
  }, [usage]);

  if (loading && !usage) {
    return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}><div className="h-6 w-44 animate-pulse rounded bg-slate-100" /><div className="mt-5 h-20 animate-pulse rounded-2xl bg-slate-100" /><div className="mt-3 h-24 animate-pulse rounded-2xl bg-slate-100" /></section>;
  }
  if (!usage) return null;

  const percentUsed = usage.credits.monthly > 0 ? Math.min(100, Math.round((usage.credits.used / usage.credits.monthly) * 100)) : 0;
  const availableAfter = (cost: number) => Math.max(0, usage.credits.available - cost);
  const imageRows = [
    ['Preview', usage.features.imageGeneration.preview],
    ['Standard', usage.features.imageGeneration.standard],
    ['Premium', usage.features.imageGeneration.premium],
  ] as const;
  const analysisRows = [
    ['Basic', usage.features.imageAnalysis.basic],
    ['Medium', usage.features.imageAnalysis.medium],
    ['Hard', usage.features.imageAnalysis.hard],
  ] as const;
  const videoRows = [
    ['Standard · 720p', usage.features.videoAd.standard],
    ['High-End · 1080p', usage.features.videoAd.high_end],
  ] as const;

  return <section className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`} aria-label="Media usage and credit calculator">
    <div className="border-b border-slate-100 p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Live usage</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Credits, uploads & feature costs</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Everything below uses your current plan limits. The panel refreshes automatically so you can see what an action will cost before you run it.</p>
        </div>
        <button type="button" onClick={() => void loadUsage(true)} disabled={refreshing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Available now</p>
          <p className="mt-1 text-2xl font-semibold">{usage.credits.available}</p>
          <p className="mt-1 text-xs text-slate-400">of {usage.credits.monthly} monthly credits</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Used</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{usage.credits.used}</p>
          <p className="mt-1 text-xs text-slate-500">{percentUsed}% of monthly allowance</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reserved</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{usage.credits.reserved}</p>
          <p className="mt-1 text-xs text-slate-500">Temporarily held by active jobs</p>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Uploads</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{usage.uploads.total}</p>
          <p className="mt-1 text-xs text-slate-500">{usage.uploads.maxPerProject} max per project</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400"><span>Monthly credit usage</span><span>{usage.credits.used} / {usage.credits.monthly}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${percentUsed}%` }} /></div>
      </div>
    </div>

    <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-3">
      <FeatureCard icon={<ImageIcon className="size-4" />} title="Image generation" subtitle="Choose a quality before you generate.">
        {imageRows.map(([label, cost]) => <CostRow key={label} label={label} cost={cost} available={usage.credits.available} after={availableAfter(cost)} maxCost={maxCost} />)}
      </FeatureCard>
      <FeatureCard icon={<Calculator className="size-4" />} title="Image authenticity analysis" subtitle="Analysis uses credits but intentionally skips generation upload safety.">
        {analysisRows.map(([label, cost]) => <CostRow key={label} label={label} cost={cost} available={usage.credits.available} after={availableAfter(cost)} maxCost={maxCost} />)}
      </FeatureCard>
      <FeatureCard icon={<Video className="size-4" />} title="Video generation" subtitle={`${usage.video.minDurationSeconds}–${usage.video.maxDurationSeconds}s · ${usage.video.audio ? 'audio on' : 'silent output'}`}>
        {videoRows.map(([label, cost]) => <CostRow key={label} label={label} cost={cost} available={usage.credits.available} after={availableAfter(cost)} maxCost={maxCost} />)}
      </FeatureCard>
    </div>

    <div className="grid gap-4 border-t border-slate-100 p-5 sm:p-6 lg:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2"><UploadCloud className="size-4 text-slate-600" /><p className="text-sm font-semibold text-slate-950">Upload limits</p></div>
        <p className="mt-2 text-sm leading-6 text-slate-600">You have <strong className="text-slate-950">{usage.uploads.total}</strong> active uploads across this workspace. Your plan allows up to <strong className="text-slate-950">{usage.uploads.maxPerProject} uploads per project</strong>. {usage.uploads.note}</p>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" /><p className="text-sm font-semibold text-slate-950">How the calculation works</p></div>
        <p className="mt-2 text-sm leading-6 text-slate-600">Example: {usage.credits.available} available credits minus the selected feature cost. The number beside each option tells you how many times that option can run right now.</p>
      </div>
    </div>
  </section>;
}

function FeatureCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span><div><p className="text-sm font-semibold text-slate-950">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div></div><div className="mt-4 space-y-2">{children}</div></div>;
}

function CostRow({ label, cost, available, after, maxCost }: { label: string; cost: number; available: number; after: number; maxCost: number }) {
  const count = actionCount(available, cost);
  const unavailable = cost <= 0;
  const affordable = !unavailable && available >= cost;
  const fill = maxCost > 0 && cost > 0 ? Math.min(100, Math.max(6, (cost / maxCost) * 100)) : 0;
  return <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-900">{label}</p><p className={`mt-0.5 text-[11px] ${unavailable ? 'text-slate-400' : affordable ? 'text-emerald-600' : 'text-amber-600'}`}>{costLabel(cost)}{unavailable ? '' : ` · ${count} more now`}</p></div><span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700">{unavailable ? '—' : `${cost}`}</span></div>
    {!unavailable && <><div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-900" style={{ width: `${fill}%` }} /></div><p className="mt-2 text-[10px] text-slate-400">After 1 run: <strong className="text-slate-600">{after} credits</strong> remaining</p></>}
  </div>;
}
