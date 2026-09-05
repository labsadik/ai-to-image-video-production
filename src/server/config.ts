import { PROVIDER_CATALOG } from '@/config/providers';

export function assertServerConfig() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
  for (const [name, provider] of Object.entries(PROVIDER_CATALOG)) {
    if (provider.enabled && !process.env[provider.secretEnv]) {
      throw new Error(`Enabled provider ${name} is missing ${provider.secretEnv}`);
    }
  }
}
