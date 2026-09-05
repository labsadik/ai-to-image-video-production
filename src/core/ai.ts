import { GENERATION_PLANS } from '@/config/plans';
import { PROVIDER_CATALOG, type ProviderName, type QualityKey } from '@/config/providers';

export type GenerationQuality = QualityKey;
export type Operation = 'generateImage' | 'editImage' | 'enhanceImage' | 'detectImage';

export interface ReferenceImage {
  mimeType: string;
  base64: string;
}

export interface GenerationRequest {
  userId: string;
  plan: keyof typeof GENERATION_PLANS;
  operation: Exclude<Operation, 'detectImage'>;
  prompt: string;
  size: string;
  width: number;
  height: number;
  quality: GenerationQuality;
  referenceImages?: ReferenceImage[];
}

export interface ProviderResult {
  externalId: string;
  mimeType: string;
  base64: string;
  providerMetadata?: Record<string, unknown>;
}

export interface ProviderAdapter {
  provider: ProviderName;
  generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult>;
  healthCheck(apiKey: string): Promise<{ ok: boolean; latencyMs: number; message?: string }>;
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

export function requiredCredits(plan: GenerationRequest['plan'], quality: GenerationQuality) {
  return GENERATION_PLANS[plan].credits[quality];
}
