import { getSupabaseAdmin } from './supabase-admin';

export type ProviderProtocol = 'google_gemini' | 'fal_video';

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

export async function resolveProviderConfig(providerId: string, modelId: string): Promise<RuntimeProviderConfig> {
  const admin = getSupabaseAdmin();
  const [{ data: provider, error: providerError }, { data: model, error: modelError }] = await Promise.all([
    admin.from('ai_providers').select('id,enabled,secret_env,base_url,protocol,request_config,timeout_ms').eq('id', providerId).maybeSingle(),
    admin.from('ai_models').select('id,provider_id,model_key,enabled').eq('id', modelId).maybeSingle(),
  ]);
  if (providerError) throw new Error(`AI provider lookup failed: ${providerError.message}`);
  if (modelError) throw new Error(`AI model lookup failed: ${modelError.message}`);
  if (!provider?.enabled || !model?.enabled || model.provider_id !== provider.id) throw new Error(`AI provider/model is disabled or mismatched: ${providerId}/${modelId}`);
  if (provider.protocol !== 'google_gemini' && provider.protocol !== 'fal_video') throw new Error(`Unsupported AI provider protocol: ${provider.protocol}`);
  return {
    provider: provider.id,
    protocol: provider.protocol as ProviderProtocol,
    baseUrl: provider.base_url ?? '',
    secretEnv: provider.secret_env,
    model: model.model_key,
    timeoutMs: Number(provider.timeout_ms ?? 120000),
    requestConfig: (provider.request_config ?? {}) as RuntimeProviderConfig['requestConfig'],
  };
}
