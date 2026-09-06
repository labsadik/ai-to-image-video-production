import { getProviderAdapter } from '@/core/provider-registry';
import { getSupabaseAdmin } from './supabase-admin';
import { getProviderSecret } from './provider-secrets';
import { resolveProviderConfig } from './provider-config';

export async function checkProvider(providerId: string, modelId: string) {
  const admin = getSupabaseAdmin();
  const config = await resolveProviderConfig(providerId, modelId);
  const apiKey = await getProviderSecret(providerId, config.secretEnv);
  const adapter = getProviderAdapter(config);
  const result = await adapter.healthCheck(apiKey, config.model);
  await admin.from('provider_health_events').insert({ provider_id: providerId, ok: result.ok, latency_ms: result.latencyMs, message: result.message, capabilities: {} });
  await admin.from('ai_providers').update({
    health_status: result.ok ? 'healthy' : 'unhealthy',
    health_checked_at: new Date().toISOString(),
    health_latency_ms: result.latencyMs,
    health_message: result.message ?? null,
    health_failures: result.ok ? 0 : 1,
  }).eq('id', providerId);
  return result;
}
