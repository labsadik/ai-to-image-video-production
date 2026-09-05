import { getSupabaseServerClient } from './supabase';
import { getSupabaseAdmin } from './supabase-admin';

export async function requireAdmin() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Response('Unauthorized', { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') throw new Response('Forbidden', { status: 403 });

  return { user, admin };
}
