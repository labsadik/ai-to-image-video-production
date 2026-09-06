'use client';

import { Coins, Loader2, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';

export function CreditWallet({ monthly, addon }: { monthly: number; addon: number }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function addCredits() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'addon' }),
      });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to open secure checkout.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open secure checkout.');
      setLoading(false);
    }
  }

  const total = monthly + addon;

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Wallet className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Credit wallet</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{total.toLocaleString()} credits available</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">Monthly credits renew with your plan. Purchased credits never expire.</p>
        </div>
      </div>
      <button type="button" onClick={() => void addCredits()} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
        {loading ? 'Opening checkout…' : 'Add 50 credits · $5'}
      </button>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Sparkles className="size-3.5" />Monthly</div><p className="mt-2 text-2xl font-semibold text-slate-950">{monthly.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Renewing plan balance</p></div>
      <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Coins className="size-3.5" />Purchased</div><p className="mt-2 text-2xl font-semibold text-slate-950">{addon.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Never expires</p></div>
    </div>
    {message && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{message}</p>}
  </section>;
}
