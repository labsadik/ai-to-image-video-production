import { GENERATION_PLANS } from '@/config/plans';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';
import { requiredCredits, type GenerationRequest } from '@/core/ai';
import { PolicySafetyEngine, type SafetyResult } from '@/core/safety';
import { resolveLiveProviderModel } from './provider-config';

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
}

export async function planGeneration(request: GenerationRequest & { platform?: PlatformId }): Promise<PlannedGeneration> {
  const safetyResult = await safety.check({ prompt: request.prompt, assetUrls: [] });
  if (safetyResult.decision !== 'allow') throw new Error(`Safety decision: ${safetyResult.decision}`);

  const route = await resolveLiveProviderModel(request.plan, request.quality);
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
  };
}
