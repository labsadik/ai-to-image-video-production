import Link from 'next/link';
import { ArrowLeft, Check, Globe2, Sparkles } from 'lucide-react';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { PlanComparison } from '@/components/plan-comparison';

export const dynamic = 'force-dynamic';

const countries = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
];

export default async function PricingPage() {
  const admin = getSupabaseAdmin();
  const { data: prices } = await admin.from('plan_prices').select('plan_id,country_code,currency,unit_amount_minor').eq('active', true).in('country_code', countries.map((country) => country.code));
  const defaultPrices = Object.fromEntries((prices ?? []).filter((price) => price.country_code === 'IN').map((price) => [price.plan_id, price.unit_amount_minor]));
  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"><Link href="/" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-white"><Sparkles className="size-4"/></span><span className="text-sm font-semibold">Solamentis</span></Link><Link href="/login" className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Sign in</Link></div></header>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="size-4"/> Home</Link><section className="mt-7 max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Plans & pricing</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Choose a plan that grows with your creative work.</h1><p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">See monthly capacity, regional pricing, upload limits, premium access, and long-period benefits before creating an account.</p></section><div className="mt-8 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Globe2 className="mt-0.5 size-4 shrink-0 text-slate-600"/><p className="text-xs leading-5 text-slate-500">Regional prices are selected by billing country at checkout. The pricing view defaults to India for visitors; authenticated users see their saved billing country.</p></div><section className="mt-6"><PlanComparison prices={defaultPrices} currency={(prices?.find((price) => price.country_code === 'IN')?.currency ?? 'USD').toUpperCase()} initialPlan="pro"/></section><section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100"><Check className="size-5"/></span><div><h2 className="text-sm font-semibold">What changes by billing period?</h2><p className="mt-1 text-sm leading-6 text-slate-500">One month is the flexible option. Six months and one year unlock the long-period benefits defined in the plan comparison, including eligible upcoming-feature access for paid plans.</p></div></div></section></div>
  </main>;
}
