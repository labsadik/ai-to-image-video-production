'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, CreditCard, ShieldCheck } from 'lucide-react';

type Plan = { id:string; name:string; fallbackPrice:string; credits:string; desc:string; features:string[]; monthly:number };
type Props = { plans: Plan[]; currency: string };

const periods = [{id:1,label:'1 month',discount:0},{id:6,label:'6 months',discount:0},{id:12,label:'1 year',discount:0}];

export function BillingPlans({ plans, currency }: Props) {
  const [period,setPeriod]=useState(1);
  const [selected,setSelected]=useState(plans.find(p=>p.id==='pro')?.id ?? plans[0]?.id ?? 'free');
  const selectedPlan = plans.find(p=>p.id===selected) ?? plans[0];
  const total = useMemo(()=>Math.round((selectedPlan?.monthly ?? 0)*period),[selectedPlan,period]);
  return <>
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Billing period</p><p className="mt-1 text-xs text-slate-500">Longer periods are calculated from the monthly regional price. Final checkout rules will be enforced by the billing provider.</p></div><div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">{periods.map(p=><button key={p.id} type="button" onClick={()=>setPeriod(p.id)} className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition ${period===p.id?'bg-white text-slate-950 shadow-sm':'text-slate-500 hover:text-slate-900'}`}>{p.label}</button>)}</div></div>
    <div className="grid gap-5 lg:grid-cols-3">{plans.map(p=>{const active=(p.id===selected);return <div key={p.id} className={`flex flex-col rounded-3xl border p-6 shadow-sm transition ${active?'border-slate-950 bg-slate-950 text-white shadow-xl':'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md'}`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-semibold">{p.name}</h2><p className={`mt-1 text-xs ${active?'text-slate-400':'text-slate-500'}`}>{p.desc}</p></div>{active&&<span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">Selected</span>}</div><p className="mt-8 text-3xl font-semibold tracking-tight">{p.monthly?`${currency} ${(p.monthly/100).toLocaleString()}`:p.fallbackPrice}<span className={`text-sm font-medium ${active?'text-slate-400':'text-slate-500'}`}> / month</span></p><p className={`mt-2 text-sm ${active?'text-slate-300':'text-slate-500'}`}>{p.credits}</p><div className="mt-6 flex-1 space-y-3">{p.features.map(f=><div key={f} className="flex items-center gap-2 text-sm"><Check className={`size-4 ${active?'text-white':'text-emerald-600'}`}/>{f}</div>)}</div><button type="button" onClick={()=>setSelected(p.id)} className={`mt-8 min-h-11 rounded-xl px-4 text-sm font-semibold ${active?'bg-white text-slate-950':'bg-slate-950 text-white hover:bg-slate-800'}`}>{active?'Selected':'Select plan'}</button></div>})}</div>
    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Checkout summary</p><p className="mt-2 text-lg font-semibold">{selectedPlan?.name} · {period === 12 ? '1 year' : `${period} month${period>1?'s':''}`}</p><p className="mt-1 text-sm text-slate-500">Estimated total: <strong className="text-slate-900">{currency} {(total/100).toLocaleString()}</strong>. Payment provider and taxes determine the final charge.</p></div><Link href={`/dashboard/billing/checkout?plan=${selected}&months=${period}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">Continue to checkout <ArrowRight className="size-4"/></Link></div>
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-700"/><p>Subscription state is stored in Supabase and the final billing lifecycle will be synchronized from verified provider events. Live payment is intentionally not triggered from this preview until production billing credentials are configured.</p></div>
  </>;
}
