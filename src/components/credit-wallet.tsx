'use client';

import { Coins, Loader2, Sparkles, Wallet } from 'lucide-react';
import { useState } from 'react';

type CreditPack = { id: string; name: string; credits: number; unitAmountMinor: number };

type Props = {
  monthly: number;
  addon: number;
  currency: string;
  packs: CreditPack[];
  nextExpiryAt?: string | null;
  nextExpiryCredits?: number;
};

function formatExpiry(value: string | null | undefined) {
  if (!value) return 'No purchased-credit expiry scheduled';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function CreditWallet({ monthly, addon, currency, packs, nextExpiryAt, nextExpiryCredits = 0 }: Props) {
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const total = monthly + addon;

  async function buyPack(productId: string) {
    setLoading(productId);
    setMessage('');
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'credit_pack', productId }) });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to open secure checkout.');
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open secure checkout.');
      setLoading('');
    }
  }

  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white"><Wallet className="size-5" /></span>
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Credit wallet</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{total.toLocaleString()} credits available</h2><p className="mt-1 text-sm leading-5 text-slate-500">Monthly credits renew with your plan. Purchased credits expire 1 year after purchase.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Sparkles className="size-3.5" />Monthly</div><p className="mt-2 text-2xl font-semibold text-slate-950">{monthly.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Renewing plan balance</p></div>
        <div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Coins className="size-3.5" />Purchased</div><p className="mt-2 text-2xl font-semibold text-slate-950">{addon.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Each purchase has its own 1-year expiry</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Next purchased expiry</p><p className="mt-2 text-lg font-semibold text-amber-950">{formatExpiry(nextExpiryAt)}</p><p className="mt-1 text-xs text-amber-800">{nextExpiryAt && nextExpiryCredits > 0 ? `${nextExpiryCredits.toLocaleString()} credits in the next expiring purchase` : 'Expiry reminders are automated'}</p></div>
      </div>
      <div>
        <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">Top up credits</p><p className="mt-1 text-xs text-slate-500">Choose the amount that fits your workload. Pricing follows your billing country and local currency.</p></div><span className="text-xs font-semibold text-slate-400">Max 1,299 credits</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{packs.map((pack) => { const isLoading = loading === pack.id; return <button key={pack.id} type="button" onClick={() => void buyPack(pack.id)} disabled={Boolean(loading)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-950 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-950">{pack.name}</span>{isLoading && <Loader2 className="size-4 animate-spin" />}</div><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{pack.credits.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">credits · {currency} {(pack.unitAmountMinor / 100).toLocaleString()}</p></button>; })}</div>
      </div>
    </div>
    {message && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{message}</p>}
  </section>;
}
