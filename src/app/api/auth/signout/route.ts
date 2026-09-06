import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function POST() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (user) {
    const admin = getSupabaseAdmin();
    await admin.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    await admin.from('audit_logs').insert({ user_id: user.id, actor_type: 'user', action: 'auth.signout', resource_type: 'session', metadata: {} });
  }
  await client.auth.signOut();
  return NextResponse.json({ ok: true });
}
