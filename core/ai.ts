import { GENERATION_PLANS } from '@/config/plans';
import { PROVIDER_CATALOG, type QualityKey } from '@/config/providers';

export type GenerationQuality = QualityKey;
export type FeatureCategory = 'image_generation';
export type Operation = 'generateImage';

export interface ReferenceImage {
  mimeType: string;
  base64: string;
}

export interface GenerationRequest {
  userId: string;
  plan: keyof typeof GENERATION_PLANS;
  operation: Operation;
  category?: FeatureCategory;
  prompt: string;
  size: string;
  width: number;
  height: number;
  quality: GenerationQuality;
  referenceImages?: ReferenceImage[];
  referenceImageStoragePaths?: string[];
}

export interface ProviderResult {
  externalId: string;
  mimeType: string;
  base64: string;
  providerMetadata?: Record<string, unknown>;
}

export interface ProviderAdapter {
  provider: string;
  generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult>;
  healthCheck(apiKey: string, model?: string): Promise<{ ok: boolean; latencyMs: number; message?: string }>;
}

export function resolveModel(plan: GenerationRequest['plan'], quality: GenerationQuality) {
  const planConfig = GENERATION_PLANS[plan];
  const route = planConfig.models[quality];
  const provider = PROVIDER_CATALOG[route.provider];
  if (!provider?.enabled) throw new Error(`No enabled provider configured for ${route.provider}`);
  const model = provider.models[route.tier];
  if (!model) throw new Error(`No model configured for ${route.provider}:${route.tier}`);
  return { providerName: route.provider, model, secretEnv: provider.secretEnv };
}

export function requiredCredits(_plan: GenerationRequest['plan'], quality: GenerationQuality) {
  return quality === 'preview' ? 1 : quality === 'standard' ? 5 : 10;
}
