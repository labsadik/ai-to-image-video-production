import { CreditCard } from 'lucide-react';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { BillingPlans } from './billing-plans';

const planContent = {
  free:{name:'Free',fallbackPrice:'$0',credits:'10 credits / month',desc:'Explore the studio',features:['1 upload / project','Watermarked output','Platform presets']},
  pro:{name:'Pro',fallbackPrice:'$10',credits:'100 credits / month',desc:'For independent creators',features:['10 uploads / project','No watermark','Premium quality']},
  business:{name:'Business',fallbackPrice:'$30',credits:'1,000 credits / month',desc:'For teams and production',features:['30 uploads / project','No watermark','Higher throughput']},
} as const;

export default async function BillingPage(){
  const client=await getSupabaseServerClient(); const {data:{user}}=await client.auth.getUser(); if(!user)return null;
  const admin=getSupabaseAdmin();
  const [{data:profile},{data:regions}]=await Promise.all([
    admin.from('profiles').select('plan_id,billing_country_code,country_code').eq('id',user.id).single(),
    admin.from('pricing_regions').select('country_code,currency').eq('active',true).order('country_code'),
  ]);
  const country=profile?.billing_country_code||profile?.country_code||'IN';
  const {data:prices}=await admin.from('plan_prices').select('plan_id,country_code,currency,unit_amount_minor').eq('country_code',country).eq('active',true);
  const priceMap=Object.fromEntries((prices??[]).map(p=>[p.plan_id,{currency:p.currency,minor:p.unit_amount_minor}]));
  const currency=priceMap.pro?.currency||priceMap.business?.currency||priceMap.free?.currency||regions?.find(r=>r.country_code===country)?.currency||'USD';
  const plans=Object.entries(planContent).map(([id,p])=>({id,name:p.name,fallbackPrice:p.fallbackPrice,credits:p.credits,desc:p.desc,features:p.features,monthly:priceMap[id]?.minor??0}));
  return <div className="space-y-7"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Billing</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Choose the capacity you need.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Compare plans, choose a billing period, and continue to the Solamentis checkout experience. Regional prices come from your billing profile.</p></div><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><span className="grid size-9 place-items-center rounded-xl bg-slate-100"><CreditCard className="size-4"/></span><span>Billing country: <strong className="font-semibold text-slate-900">{country}</strong> · Currency: <strong className="font-semibold text-slate-900">{currency}</strong></span></div><BillingPlans plans={plans} currency={currency}/></div>;
}
