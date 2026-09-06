import 'server-only';

import { getSupabaseAdmin } from './supabase-admin';
import { resolveProviderConfig, type RuntimeProviderConfig } from './provider-config';
import type { PublicGenerationQuality } from '@/config/plans';

export type FeatureCategory = 'social_image' | 'text_graphic' | 'image_analysis' | 'video_ad';

const qualityMap: Record<'preview' | 'standard' | 'premium', PublicGenerationQuality> = {
  preview: 'basic',
  standard: 'medium',
  premium: 'ultra',
};

export function publicQualityForRuntime(quality: 'preview' | 'standard' | 'premium'): PublicGenerationQuality {
  return qualityMap[quality];
}

export async function resolveFeatureRoute(planId: string, category: FeatureCategory, quality: PublicGenerationQuality): Promise<RuntimeProviderConfig & { fallbackProviderId?: string; fallbackModelId?: string }> {
  const admin = getSupabaseAdmin();
  const { data: route, error } = await admin
    .from('ai_feature_routes')
    .select('enabled,provider_id,model_id,fallback_provider_id,fallback_model_id')
    .eq('plan_id', planId)
    .eq('category', category)
    .eq('quality', quality)
    .maybeSingle();
  if (error) throw new Error(`AI feature route lookup failed: ${error.message}`);
  if (!route?.enabled) throw new Error(`No active AI route for plan=${planId}, category=${category}, quality=${quality}`);
  const primary = await resolveProviderConfig(route.provider_id, route.model_id);
  return {
    ...primary,
    fallbackProviderId: route.fallback_provider_id ?? undefined,
    fallbackModelId: route.fallback_model_id ?? undefined,
  };
}
