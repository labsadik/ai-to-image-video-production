import { CreditCard } from 'lucide-react';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { PlanComparison } from '@/components/plan-comparison';
import { CreditWallet } from '@/components/credit-wallet';

export default async function BillingPage(){
  const client=await getSupabaseServerClient(); const {data:{user}}=await client.auth.getUser(); if(!user)return null;
  const admin=getSupabaseAdmin();
  const [{data:profile},{data:prices}]=await Promise.all([
    admin.from('profiles').select('plan_id,billing_country_code,country_code,monthly_credits,addon_credits').eq('id',user.id).single(),
    admin.from('plan_prices').select('plan_id,country_code,currency,unit_amount_minor').eq('active',true),
  ]);
  const country=profile?.billing_country_code||profile?.country_code||'IN';
  const regional=(prices??[]).filter((price)=>price.country_code===country);
  const priceMap=Object.fromEntries(regional.map((price)=>[price.plan_id,price.unit_amount_minor]));
  const currency=(regional[0]?.currency||'USD').toUpperCase();
  return <div className="space-y-7 sm:space-y-8">
    <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Billing</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">Plans & credit wallet</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage your subscription and top up your shared Solamentis credit balance without changing tools or projects.</p></div>
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100"><CreditCard className="size-4"/></span><span>Billing country: <strong className="font-semibold text-slate-900">{country}</strong> · Currency: <strong className="font-semibold text-slate-900">{currency}</strong></span></div>
    <CreditWallet monthly={Math.max(0,Number(profile?.monthly_credits??0))} addon={Math.max(0,Number(profile?.addon_credits??0))} />
    <PlanComparison prices={priceMap} currency={currency} initialPlan={(profile?.plan_id==='business'||profile?.plan_id==='free'||profile?.plan_id==='pro')?profile.plan_id:'free'}/>
  </div>;
}
