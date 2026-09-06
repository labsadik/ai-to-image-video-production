import { GENERATION_PLANS, publicQuality, type PublicGenerationQuality } from '@/config/plans';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';
import { requiredCredits, type GenerationRequest } from '@/core/ai';
import { PolicySafetyEngine, SafetyPolicyViolation, type SafetyResult } from '@/core/safety';
import { resolveLiveEditProviderModel } from './provider-config';
import { resolveFeatureRoute, type FeatureCategory } from './feature-routing';
import { getActiveSafetyPolicyVersion } from './safety-events';

const safety = new PolicySafetyEngine();

export interface PlannedGeneration {
  providerName: string;
  model: string;
  secretEnv: string;
  credits: number;
  watermark: boolean;
  width: number;
  height: number;
  maxExportBytes: number;
  safety: SafetyResult;
  category: FeatureCategory;
  requestedQuality: PublicGenerationQuality;
  fallbackProviderId?: string;
  fallbackModelId?: string;
}

export async function planGeneration(request: GenerationRequest & { platform?: PlatformId }): Promise<PlannedGeneration> {
  const [safetyResult, policyVersion] = await Promise.all([
    safety.check({ prompt: request.prompt, assetUrls: [] }),
    getActiveSafetyPolicyVersion(),
  ]);
  safetyResult.policyVersion = policyVersion;
  if (safetyResult.decision !== 'allow') throw new SafetyPolicyViolation(safetyResult);

  const requestedQuality = publicQuality(request.quality);
  const category: FeatureCategory = request.category ?? 'social_image';
  const route = request.operation === 'editImage'
    ? await resolveLiveEditProviderModel(request.plan, request.quality)
    : await resolveFeatureRoute(request.plan, category, requestedQuality);
  const plan = GENERATION_PLANS[request.plan];
  const platform = request.platform ? PLATFORM_SPECS[request.platform] : undefined;

  return {
    providerName: route.provider,
    model: route.model,
    secretEnv: route.secretEnv,
    credits: requiredCredits(request.plan, request.quality),
    watermark: plan.watermark,
    width: platform?.width ?? request.width,
    height: platform?.height ?? request.height,
    maxExportBytes: platform?.maxBytes ?? 8_000_000,
    safety: safetyResult,
    category,
    requestedQuality,
    fallbackProviderId: route.fallbackProviderId,
    fallbackModelId: route.fallbackModelId,
  };
}
