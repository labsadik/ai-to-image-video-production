import { getSupabaseAdmin } from './supabase-admin';
import type { QualityKey } from '@/config/providers';

export type ProviderProtocol = 'google_gemini' | 'openai_images' | 'generic_json';

export interface RuntimeProviderConfig {
  provider: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  secretEnv: string;
  model: string;
  timeoutMs: number;
  requestConfig: {
    path?: string;
    healthPath?: string;
    method?: string;
    auth?: 'bearer' | 'api-key' | 'custom' | 'none';
    authHeader?: string;
    headers?: Record<string, string>;
    body?: unknown;
    response?: { base64Path?: string; mimeTypePath?: string; externalIdPath?: string };
  };
}

export async function resolveLiveProviderModel(planId: string, quality: QualityKey): Promise<RuntimeProviderConfig> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('ai_plan_routes')
    .select('enabled, provider_id, model_id, ai_providers!inner(id, enabled, secret_env, base_url, protocol, request_config, timeout_ms), ai_models!inner(model_key, enabled)')
    .eq('plan_id', planId)
    .eq('quality', quality)
    .maybeSingle();

  if (!error && data?.enabled && data.ai_providers?.enabled && data.ai_models?.enabled) {
    const provider = data.ai_providers as Record<string, unknown>;
    return {
      provider: String(provider.id),
      protocol: String(provider.protocol) as ProviderProtocol,
      baseUrl: String(provider.base_url ?? ''),
      secretEnv: String(provider.secret_env),
      model: String(data.ai_models.model_key),
      timeoutMs: Number(provider.timeout_ms ?? 120000),
      requestConfig: (provider.request_config ?? {}) as RuntimeProviderConfig['requestConfig'],
    };
  }

  throw new Error(`No active AI route for plan=${planId}, quality=${quality}`);
}
