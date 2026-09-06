import { CreditCard } from 'lucide-react';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { PlanComparison } from '@/components/plan-comparison';
import { CreditWallet } from '@/components/credit-wallet';

export default async function BillingPage(){
  const client=await getSupabaseServerClient(); const {data:{user}}=await client.auth.getUser(); if(!user)return null;
  const admin=getSupabaseAdmin();
  const [{data:profile},{data:prices},{data:packs},{data:regions}]=await Promise.all([
    admin.from('profiles').select('plan_id,billing_country_code,country_code,monthly_credits,addon_credits').eq('id',user.id).single(),
    admin.from('plan_prices').select('plan_id,country_code,currency,unit_amount_minor').eq('active',true),
    admin.from('credit_products').select('id,display_name,credits,sort_order').eq('active',true).order('sort_order'),
    admin.from('pricing_regions').select('country_code,currency').eq('active',true),
  ]);
  const country=String(profile?.billing_country_code||profile?.country_code||'IN').toUpperCase();
  const regional=(prices??[]).filter((price)=>price.country_code===country);
  const priceMap=Object.fromEntries(regional.map((price)=>[price.plan_id,price.unit_amount_minor]));
  const region=(regions??[]).find((item)=>item.country_code===country);
  const currency=(region?.currency||regional[0]?.currency||'USD').toUpperCase();
  const {data:creditPrices}=await admin.from('credit_product_prices').select('product_id,country_code,currency,unit_amount_minor').eq('country_code',country).eq('active',true);
  const creditPriceMap=new Map((creditPrices??[]).map((price)=>[price.product_id,Number(price.unit_amount_minor)]));
  const creditPacks=(packs??[]).map((pack)=>({id:pack.id,name:pack.display_name,credits:Number(pack.credits),unitAmountMinor:creditPriceMap.get(pack.id)??0})).filter((pack)=>pack.unitAmountMinor>0).sort((a,b)=>a.credits-b.credits);
  return <div className="space-y-7 sm:space-y-8">
    <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Billing</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">Plans & credit wallet</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage your subscription and choose additional credit capacity without changing tools or projects.</p></div>
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100"><CreditCard className="size-4"/></span><span>Billing country: <strong className="font-semibold text-slate-900">{country}</strong> · Currency: <strong className="font-semibold text-slate-900">{currency}</strong></span></div>
    <CreditWallet monthly={Math.max(0,Number(profile?.monthly_credits??0))} addon={Math.max(0,Number(profile?.addon_credits??0))} currency={currency} packs={creditPacks} />
    <PlanComparison prices={priceMap} currency={currency} initialPlan={(profile?.plan_id==='business'||profile?.plan_id==='free'||profile?.plan_id==='pro')?profile.plan_id:'free'}/>
  </div>;
}
