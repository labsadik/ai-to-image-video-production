import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';
const COUNTRIES: Record<string,{name:string;locale:string}>={IN:{name:'India',locale:'en-IN'},US:{name:'United States',locale:'en-US'},BD:{name:'Bangladesh',locale:'en-BD'},GB:{name:'United Kingdom',locale:'en-GB'},AE:{name:'United Arab Emirates',locale:'en-AE'}};

async function readProfilePayload(userId:string, profile:Record<string,any>|null){
  const admin=getSupabaseAdmin();
  const {data:subscription}=await admin.from('subscriptions').select('id,plan_id,status,provider,current_period_start,current_period_end,country_code,currency,cancel_at_period_end,created_at,updated_at').eq('user_id',userId).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  const billingCountry=subscription?.country_code||profile?.billing_country_code||profile?.country_code||'IN';
  const {data:prices}=await admin.from('plan_prices').select('plan_id,currency,unit_amount_minor').eq('country_code',billingCountry).eq('active',true);
  const primary=prices?.find((price)=>price.plan_id===profile?.plan_id)||prices?.[0];
  const planPrices=Object.fromEntries((prices??[]).map((price)=>[price.plan_id,price.unit_amount_minor]));
  return {profile,subscription,planPrice:{currency:primary?.currency||subscription?.currency||'USD',unit_amount_minor:primary?.unit_amount_minor||0},planPrices};
}

export async function GET(request:Request){
  const client=await getSupabaseServerClient(); const {data:{user}}=await client.auth.getUser(); if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const admin=getSupabaseAdmin(); const detected=request.headers.get('x-vercel-ip-country')?.toUpperCase()||null; const existing=await admin.from('profiles').select('*').eq('id',user.id).maybeSingle(); if(existing.error)return NextResponse.json({error:existing.error.message},{status:500});
  if(!existing.data){const country=detected&&COUNTRIES[detected]?detected:null;const {data}=await admin.from('profiles').insert({id:user.id,email:user.email,full_name:user.user_metadata?.full_name??null,phone:user.phone??null,country_code:country,country_name:country?COUNTRIES[country].name:null,locale:country?COUNTRIES[country].locale:null,last_seen_at:new Date().toISOString()}).select('*').single();return NextResponse.json(await readProfilePayload(user.id,data));}
  const updates:Record<string,unknown>={last_seen_at:new Date().toISOString(),email:user.email??existing.data.email,phone:user.phone??existing.data.phone}; if(!existing.data.detected_country_code&&detected&&COUNTRIES[detected])updates.detected_country_code=detected; await admin.from('profiles').update(updates).eq('id',user.id); return NextResponse.json(await readProfilePayload(user.id,{...existing.data,...updates}));
}

export async function PATCH(request:Request){
  try{const client=await getSupabaseServerClient();const {data:{user}}=await client.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const body=await request.json() as Record<string,unknown>;const admin=getSupabaseAdmin();
    if(body.activity===true){const {data,error}=await admin.rpc('record_profile_login',{p_user_id:user.id});if(error)return NextResponse.json({error:error.message},{status:400});await admin.from('audit_logs').insert({user_id:user.id,actor_type:'user',action:'auth.login',resource_type:'session',metadata:{country_code:data?.country_code??null}});return NextResponse.json({profile:data});}
    const fullName=typeof body.full_name==='string'?body.full_name.trim().slice(0,120):null;const phone=typeof body.phone==='string'?body.phone.trim().slice(0,32):null;const countryCode=typeof body.country_code==='string'?body.country_code.trim().toUpperCase():null;const country=countryCode&&COUNTRIES[countryCode]?COUNTRIES[countryCode]:null;if(countryCode&&!country)return NextResponse.json({error:'Unsupported country for pricing profile'},{status:400});const updates={full_name:fullName||null,phone:phone||null,country_code:countryCode,country_name:country?.name??null,locale:country?.locale??null,updated_at:new Date().toISOString()};const {data,error}=await admin.from('profiles').update(updates).eq('id',user.id).select('*').single();if(error)return NextResponse.json({error:error.message},{status:400});await admin.auth.admin.updateUserById(user.id,{user_metadata:{...user.user_metadata,full_name:fullName}});return NextResponse.json(await readProfilePayload(user.id,data));
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to update profile'},{status:400});}
}
