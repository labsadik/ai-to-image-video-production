import { requiredCredits, resolveModel, type GenerationRequest } from '@/core/ai';
import { PolicySafetyEngine } from '@/core/safety';

const safety = new PolicySafetyEngine();

export async function planGeneration(request: GenerationRequest) {
  const safetyResult = await safety.check({ prompt: request.prompt, assetUrls: [] });
  if (safetyResult.decision !== 'allow') throw new Error(`Safety decision: ${safetyResult.decision}`);
  const model = resolveModel(request.plan, request.quality);
  return { ...model, credits: requiredCredits(request.plan, request.quality), watermark: request.plan === 'free' };
}
