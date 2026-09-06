import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

const COUNTRIES: Record<string, { name: string; locale: string }> = {
  IN: { name: 'India', locale: 'en-IN' },
  US: { name: 'United States', locale: 'en-US' },
  BD: { name: 'Bangladesh', locale: 'en-BD' },
  GB: { name: 'United Kingdom', locale: 'en-GB' },
  AE: { name: 'United Arab Emirates', locale: 'en-AE' },
};

export async function GET(request: Request) {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const detected = request.headers.get('x-vercel-ip-country')?.toUpperCase() || null;
  const profile = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 500 });
  if (!profile.data) {
    const country = detected && COUNTRIES[detected] ? detected : null;
    const { data } = await admin.from('profiles').insert({ id: user.id, email: user.email, full_name: user.user_metadata?.full_name ?? null, phone: user.phone ?? null, country_code: country, country_name: country ? COUNTRIES[country].name : null, locale: country ? COUNTRIES[country].locale : null }).select('*').single();
    return NextResponse.json({ profile: data ?? null });
  }
  if (!profile.data.detected_country_code && detected && COUNTRIES[detected]) {
    await admin.from('profiles').update({ detected_country_code: detected }).eq('id', user.id);
  }
  return NextResponse.json({ profile: profile.data });
}

export async function PATCH(request: Request) {
  try {
    const client = await getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim().slice(0, 120) : null;
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : null;
    const countryCode = typeof body.country_code === 'string' ? body.country_code.trim().toUpperCase() : null;
    const country = countryCode && COUNTRIES[countryCode] ? COUNTRIES[countryCode] : null;
    if (countryCode && !country) return NextResponse.json({ error: 'Unsupported country for pricing profile' }, { status: 400 });
    const admin = getSupabaseAdmin();
    const updates = { full_name: fullName || null, phone: phone || null, country_code: countryCode, country_name: country?.name ?? null, locale: country?.locale ?? null, updated_at: new Date().toISOString() };
    const { data, error } = await admin.from('profiles').update(updates).eq('id', user.id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, full_name: fullName } });
    return NextResponse.json({ profile: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update profile' }, { status: 400 });
  }
}
