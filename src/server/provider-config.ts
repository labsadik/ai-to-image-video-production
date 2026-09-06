import { getSupabaseAdmin } from './supabase-admin';
import type { QualityKey } from '@/config/providers';

export type ProviderProtocol = 'google_gemini' | 'openai_images' | 'generic_json' | 'huggingface_image' | 'huggingface_vlm' | 'huggingface_image_classification';

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
    provider?: string;
  };
}

async function getProvider(providerId: string) {
  const admin = getSupabaseAdmin();
  const { data: provider, error } = await admin
    .from('ai_providers')
    .select('id,enabled,secret_env,base_url,protocol,request_config,timeout_ms')
    .eq('id', providerId)
    .maybeSingle();
  if (error) throw new Error(`AI provider lookup failed: ${error.message}`);
  if (!provider?.enabled) throw new Error(`AI provider is disabled: ${providerId}`);
  return provider;
}

function toRuntimeConfig(provider: Awaited<ReturnType<typeof getProvider>>, modelKey: string): RuntimeProviderConfig {
  return {
    provider: provider.id,
    protocol: provider.protocol as ProviderProtocol,
    baseUrl: provider.base_url ?? '',
    secretEnv: provider.secret_env,
    model: modelKey,
    timeoutMs: Number(provider.timeout_ms ?? 120000),
    requestConfig: (provider.request_config ?? {}) as RuntimeProviderConfig['requestConfig'],
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
  return toRuntimeConfig(provider, model.model_key);
}

async function resolveEnvSelectedProvider(quality: QualityKey, operation: 'generateImage' | 'editImage' = 'generateImage'): Promise<RuntimeProviderConfig | null> {
  const selected = process.env.SOLAMENTIS_ACTIVE_PROVIDER?.trim().toLowerCase();
  if (!selected) return null;

  const admin = getSupabaseAdmin();
  const provider = await getProvider(selected);
  const capability = operation === 'editImage' ? 'supports_edit' : 'supports_generate';
  const { data: models, error: modelError } = await admin
    .from('ai_models')
    .select('id,provider_id,model_key,enabled,supports_generate,supports_edit,metadata')
    .eq('provider_id', provider.id)
    .eq('enabled', true)
    .eq(capability, true);
  if (modelError) throw new Error(`Configured AI provider model lookup failed: ${modelError.message}`);

  const matching = (models ?? []).find(model => {
    if (operation === 'editImage') return true;
    const metadata = (model.metadata ?? {}) as Record<string, unknown>;
    const tiers = Array.isArray(metadata.tiers) ? metadata.tiers.map(String) : [];
    const tier = typeof metadata.tier === 'string' ? metadata.tier : '';
    return tier === quality || tiers.includes(quality);
  });
  if (!matching) throw new Error(`No enabled ${operation === 'editImage' ? 'editing' : 'generation'} model configured for ${selected}${operation === 'editImage' ? '' : ` at quality=${quality}`}`);

  return toRuntimeConfig(provider, matching.model_key);
}

export async function resolveLiveProviderModel(planId: string, quality: QualityKey): Promise<RuntimeProviderConfig & { fallbackProviderId?: string; fallbackModelId?: string }> {
  const admin = getSupabaseAdmin();
  const { data: route, error: routeError } = await admin
    .from('ai_plan_routes')
    .select('enabled, provider_id, model_id, fallback_provider_id, fallback_model_id')
    .eq('plan_id', planId)
    .eq('quality', quality)
    .maybeSingle();
  if (routeError) throw new Error(`AI route lookup failed: ${routeError.message}`);
  if (!route?.enabled) throw new Error(`No active AI route for plan=${planId}, quality=${quality}`);

  const envSelected = await resolveEnvSelectedProvider(quality, 'generateImage');
  const primary = envSelected ?? await resolveProviderConfig(route.provider_id, route.model_id);
  return { ...primary, fallbackProviderId: route.fallback_provider_id ?? undefined, fallbackModelId: route.fallback_model_id ?? undefined };
}

export async function resolveLiveEditProviderModel(planId: string, quality: QualityKey): Promise<RuntimeProviderConfig> {
  const admin = getSupabaseAdmin();
  const envSelected = await resolveEnvSelectedProvider(quality, 'editImage');
  if (envSelected) return envSelected;

  const { data: route, error: routeError } = await admin
    .from('ai_plan_routes')
    .select('enabled,provider_id,model_id')
    .eq('plan_id', planId)
    .eq('quality', quality)
    .maybeSingle();
  if (routeError) throw new Error(`AI edit route lookup failed: ${routeError.message}`);
  if (!route?.enabled) throw new Error(`No active AI route for plan=${planId}, quality=${quality}`);

  const provider = await getProvider(route.provider_id);
  const { data: models, error: modelError } = await admin
    .from('ai_models')
    .select('model_key,supports_edit,metadata,updated_at')
    .eq('provider_id', provider.id)
    .eq('enabled', true)
    .eq('supports_edit', true)
    .order('updated_at', { ascending: false });
  if (modelError) throw new Error(`AI edit model lookup failed: ${modelError.message}`);
  const matching = models?.[0];
  if (!matching) throw new Error(`No enabled edit model is configured for provider=${provider.id}`);
  return toRuntimeConfig(provider, matching.model_key);
}
