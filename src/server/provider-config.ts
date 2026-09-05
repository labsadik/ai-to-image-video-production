import { getSupabaseAdmin } from './supabase-admin';
import { PROVIDER_CATALOG, type QualityKey, type ProviderName } from '@/config/providers';

export async function resolveLiveProviderModel(planId: string, quality: QualityKey) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('ai_plan_routes')
    .select('enabled, provider_id, model_id, ai_providers!inner(enabled, secret_env), ai_models!inner(model_key, enabled)')
    .eq('plan_id', planId)
    .eq('quality', quality)
    .maybeSingle();

  if (!error && data?.enabled && data.ai_providers?.enabled && data.ai_models?.enabled) {
    return {
      providerName: data.provider_id as ProviderName,
      model: data.ai_models.model_key as string,
      secretEnv: data.ai_providers.secret_env as string,
    };
  }

  const fallbackProvider = PROVIDER_CATALOG.google;
  const fallbackModel = fallbackProvider.models[quality];
  if (!fallbackModel) throw new Error(`No model configured for ${quality}`);
  return { providerName: 'google' as const, model: fallbackModel, secretEnv: fallbackProvider.secretEnv };
}
