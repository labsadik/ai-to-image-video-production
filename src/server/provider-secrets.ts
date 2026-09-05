import { getSupabaseAdmin } from './supabase-admin';

export async function getProviderSecret(providerId: string, envName: string) {
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('get_provider_secret', { p_provider_id: providerId });
  if (error || !data) throw new Error(`Missing provider credential for ${providerId}`);
  return data as string;
}
