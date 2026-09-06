import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/server/supabase';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { DashboardShell } from '@/components/dashboard-shell';

export const runtime = 'nodejs';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('full_name,email,role,plan_id,plan,credits,credits_reserved').eq('id', user.id).maybeSingle();
  return <DashboardShell name={profile?.full_name || user.user_metadata?.full_name || ''} email={profile?.email || user.email || ''} role={profile?.role || 'user'} credits={Math.max(0, Number(profile?.credits ?? 0) - Number(profile?.credits_reserved ?? 0))} plan={profile?.plan_id || profile?.plan || 'free'}>{children}</DashboardShell>;
}
