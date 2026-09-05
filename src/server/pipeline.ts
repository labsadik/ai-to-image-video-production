import { GENERATION_PLANS } from '@/config/plans';
import { PLATFORM_SPECS, type PlatformId } from '@/config/platforms';
import { requiredCredits, type GenerationRequest } from '@/core/ai';
import { PolicySafetyEngine, SafetyPolicyViolation, type SafetyResult } from '@/core/safety';
import { resolveLiveProviderModel } from './provider-config';
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
}

export async function planGeneration(request: GenerationRequest & { platform?: PlatformId }): Promise<PlannedGeneration> {
  const [safetyResult, policyVersion] = await Promise.all([
    safety.check({ prompt: request.prompt, assetUrls: [] }),
    getActiveSafetyPolicyVersion(),
  ]);
  safetyResult.policyVersion = policyVersion;
  if (safetyResult.decision !== 'allow') throw new SafetyPolicyViolation(safetyResult);

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
