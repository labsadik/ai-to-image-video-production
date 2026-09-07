'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Calculator, Coins, ImageIcon, RefreshCw, UploadCloud, Video, X } from 'lucide-react';

type PlatformUsage = { id: string; label: string; width: number; height: number; maxBytes: number; credits: Record<'preview' | 'standard' | 'premium', number> };
type Usage = {
  plan: 'free' | 'pro' | 'business';
  credits: { monthly: number; monthlyRemaining: number; addon: number; used: number; reserved: number; available: number };
  uploads: { total: number; maxPerMonth: number; maxPerProject: number; note: string };
  features: { imageGeneration: { preview: number; standard: number; premium: number }; imageAnalysis: { basic: number; medium: number; hard: number }; videoAd: { standard: number; durations: { durationSeconds: number; credits: number }[] } };
  platforms: PlatformUsage[];
  video: { minDurationSeconds: number; maxDurationSeconds: number; audio: boolean; quality: string };
};

type Props = { className?: string };

function costLabel(cost: number) { return cost > 0 ? `${cost} credit${cost === 1 ? '' : 's'}` : 'Not available on this plan'; }
function maxRuns(available: number, cost: number) { return cost > 0 ? Math.floor(available / cost) : 0; }

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
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    if (open) {
      document.addEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  const maxCost = useMemo(() => {
    if (!usage) return 0;
    return Math.max(usage.features.imageGeneration.preview, usage.features.imageGeneration.standard, usage.features.imageGeneration.premium, usage.features.imageAnalysis.basic, usage.features.imageAnalysis.medium, usage.features.imageAnalysis.hard, ...usage.features.videoAd.durations.map((item) => item.credits));
  }, [usage]);

  return <>
    <button type="button" onClick={() => { setOpen(true); if (!usage) void loadUsage(); }} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 ${className}`} aria-haspopup="dialog" aria-expanded={open}>
      <Calculator className="size-4" /><span>Usage</span>{usage && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">{usage.credits.available.toLocaleString()}</span>}
    </button>

    {open && <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50" role="dialog" aria-modal="true" aria-labelledby="media-usage-title">
        <header className="shrink-0 border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-20 w-full max-w-[1500px] items-center gap-4 px-4 sm:px-6 lg:px-8"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Calculator className="size-5" /></div><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">Live credit usage</p><div className="mt-0.5 flex flex-wrap items-center gap-2"><h2 id="media-usage-title" className="text-xl font-semibold tracking-tight text-slate-950">Know the cost before you generate</h2>{usage && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">{usage.plan} plan</span>}</div><p className="mt-1 text-xs text-slate-500">Available credits are calculated from your real wallet minus active reservations.</p></div><button type="button" onClick={() => void loadUsage(true)} disabled={refreshing || loading} className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:inline-flex"><RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button><button type="button" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-950" aria-label="Close usage"><X className="size-5" /></button></div></header>
        <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</div>}
          {!usage && loading && <div className="grid gap-4 md:grid-cols-3"><div className="h-32 animate-pulse rounded-3xl bg-white" /><div className="h-32 animate-pulse rounded-3xl bg-white" /><div className="h-32 animate-pulse rounded-3xl bg-white" /></div>}
          {usage && <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard dark label="Available now" value={usage.credits.available} detail={`${usage.credits.monthlyRemaining} monthly + ${usage.credits.addon} purchased`} /><SummaryCard label="Monthly remaining" value={usage.credits.monthlyRemaining} detail={`${usage.credits.used} used this period`} /><SummaryCard label="Reserved" value={usage.credits.reserved} detail="Held for active generation" /><SummaryCard label="Uploads" value={usage.uploads.total} detail={`${usage.uploads.maxPerMonth} monthly · ${usage.uploads.maxPerProject} per project`} /></div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-slate-950">Image generation · platform + quality</p><p className="mt-1 text-xs leading-5 text-slate-500">Platform changes the canvas. The backend charges by quality, so the credit price is the same across supported platforms.</p></div><span className="text-xs font-semibold text-slate-400">{usage.platforms.length} platforms</span></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{(['preview', 'standard', 'premium'] as const).map((quality) => <CostCard key={quality} label={quality} cost={usage.features.imageGeneration[quality]} available={usage.credits.available} maxCost={maxCost} />)}</div><div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Supported platforms</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{usage.platforms.map((item) => <div key={item.id} className="rounded-xl border border-white bg-white px-3 py-2.5"><p className="text-xs font-semibold text-slate-900">{item.label}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.width}×{item.height} · Standard = {item.credits.standard} credits</p></div>)}</div></div></section>

            <div className="grid gap-5 lg:grid-cols-2"><FeatureCard icon={<ImageIcon className="size-5" />} title="Image authenticity analysis" subtitle="The analysis type directly changes the credit charge.">{([['Basic', usage.features.imageAnalysis.basic], ['Medium', usage.features.imageAnalysis.medium], ['Hard', usage.features.imageAnalysis.hard]] as const).map(([label, cost]) => <CostRow key={label} label={label} cost={cost} available={usage.credits.available} />)}</FeatureCard><FeatureCard icon={<Video className="size-5" />} title="Silent video generation" subtitle={`${usage.video.minDurationSeconds}–${usage.video.maxDurationSeconds}s · ${usage.video.quality} · audio ${usage.video.audio ? 'on' : 'off'}.`}>{usage.features.videoAd.durations.map((item) => <CostRow key={item.durationSeconds} label={`${item.durationSeconds} seconds`} cost={item.credits} available={usage.credits.available} />)}</FeatureCard></div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><UploadCloud className="size-5" /></span><div><p className="text-sm font-semibold text-slate-950">Upload limits</p><p className="text-xs text-slate-500">Current calendar-month usage</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Used this month" value={`${usage.uploads.total} / ${usage.uploads.maxPerMonth}`} /><Metric label="Project cap" value={String(usage.uploads.maxPerProject)} /></div><p className="mt-4 text-sm leading-6 text-slate-600">{usage.uploads.note}</p></section><section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Coins className="size-5" /></span><div><p className="text-sm font-semibold text-slate-950">Wallet rules</p><p className="text-xs text-slate-500">Backend credit lifecycle</p></div></div><div className="mt-4 space-y-2 text-sm leading-6 text-slate-600"><p>Monthly credits renew with your plan.</p><p>Purchased credits expire one year after the verified purchase timestamp.</p><p>Generation reserves credits before work starts; failed generation is refunded by the backend.</p></div></section></div>

            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-sm font-semibold text-slate-950">Need more credits?</p><p className="mt-1 text-xs leading-5 text-slate-500">Open Billing to buy a verified credit pack. This panel refreshes after the purchase completes.</p></div><Link href="/dashboard/billing?focus=credits" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Open Billing</Link></div>
          </>}
        </div></div>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3"><p className="text-xs text-slate-500">Live usage refreshes every 15 seconds while this window is open.</p><button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">Back to Studio</button></div></footer>
      </section>
    </div>}
  </>;
}

function SummaryCard({ label, value, detail, dark = false }: { label: string; value: number; detail: string; dark?: boolean }) { return <div className={`rounded-3xl border p-5 ${dark ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white'}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value.toLocaleString()}</p><p className={`mt-2 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{detail}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p></div>; }
function FeatureCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span><div><p className="text-base font-semibold text-slate-950">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div></div><div className="mt-5 space-y-3">{children}</div></section>; }
function CostCard({ label, cost, available, maxCost }: { label: string; cost: number; available: number; maxCost: number }) { const affordable = cost > 0 && available >= cost; const count = maxRuns(available, cost); const bar = maxCost > 0 && cost > 0 ? Math.max(8, Math.round((cost / maxCost) * 100)) : 0; return <div className={`rounded-2xl border p-4 ${affordable ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold capitalize text-slate-900">{label}</p><span className="text-lg font-bold text-slate-950">{cost > 0 ? cost : '—'}</span></div><p className={`mt-1 text-xs ${cost > 0 ? affordable ? 'text-emerald-600' : 'text-amber-700' : 'text-slate-400'}`}>{costLabel(cost)}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-950" style={{ width: `${bar}%` }} /></div><p className="mt-2 text-[11px] font-medium text-slate-500">{cost > 0 ? `${count.toLocaleString()} run${count === 1 ? '' : 's'} possible with this balance` : 'Unavailable on this plan'}</p></div>; }
function CostRow({ label, cost, available }: { label: string; cost: number; available: number }) { const affordable = cost > 0 && available >= cost; return <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4"><div><p className="text-sm font-semibold text-slate-900">{label}</p><p className={`mt-1 text-xs ${cost > 0 && affordable ? 'text-emerald-600' : cost > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{costLabel(cost)}</p></div><div className="text-right"><p className="text-lg font-bold text-slate-950">{cost > 0 ? cost : '—'}</p><p className="text-[11px] text-slate-500">{cost > 0 ? `${maxRuns(available, cost).toLocaleString()} runs possible` : 'Unavailable'}</p></div></div>; }
