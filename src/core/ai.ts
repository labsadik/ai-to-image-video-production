import { GENERATION_PLANS } from '@/config/plans';
import { PROVIDER_CATALOG } from '@/config/providers';

export type GenerationQuality = 'preview' | 'standard' | 'premium';
export type Operation = 'generateImage' | 'editImage' | 'enhanceImage' | 'detectImage';

export interface GenerationRequest {
  userId: string;
  plan: keyof typeof GENERATION_PLANS;
  operation: Exclude<Operation, 'detectImage'>;
  prompt: string;
  size: string;
  quality: GenerationQuality;
  referenceAssetIds?: string[];
}

export interface ProviderAdapter {
  provider: string;
  generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<{ externalId: string; outputUrl: string }>;
}

export function resolveModel(plan: GenerationRequest['plan'], quality: GenerationQuality) {
  const planConfig = GENERATION_PLANS[plan];
  const providerName = planConfig.models[quality].provider;
  const model = planConfig.models[quality].model;
  const provider = PROVIDER_CATALOG[providerName];
  if (!provider || !provider.enabled) throw new Error(`No enabled provider configured for ${providerName}`);
  return { providerName, model, secretEnv: provider.secretEnv };
}

export function requiredCredits(plan: GenerationRequest['plan'], quality: GenerationQuality) {
  return GENERATION_PLANS[plan].credits[quality];
}
