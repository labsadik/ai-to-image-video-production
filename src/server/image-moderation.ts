import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin } from './supabase-admin';
import { getProviderSecret } from './provider-secrets';
import { resolveProviderConfig } from './provider-config';
import { recordSafetyEvent } from './safety-events';
import { SOLAMENTIS_SAFETY_POLICY } from '@/config/safety-policy';
import type { SafetyDecision } from '@/core/safety';

export interface ModerationResult {
  decision: SafetyDecision;
  reasons: string[];
  score?: number;
  provider: string;
  model: string;
}

type ModerationRules = { blockPatterns?: string[]; reviewPatterns?: string[] };

class ImageModerationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageModerationUnavailableError';
  }
}

function normalizeDecision(value: unknown): SafetyDecision {
  return value === 'block' || value === 'review' || value === 'allow' ? value : 'review';
}

function parseModelJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned) as { decision?: unknown; reasons?: unknown; score?: unknown }; }
  catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as { decision?: unknown; reasons?: unknown; score?: unknown };
    throw new ImageModerationUnavailableError('Moderation model returned invalid JSON');
  }
}

function normalizeResult(payload: { decision?: unknown; reasons?: unknown; score?: unknown }, provider: string, model: string): ModerationResult {
  const reasons = Array.isArray(payload.reasons) ? payload.reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 12) : [];
  const score = typeof payload.score === 'number' && Number.isFinite(payload.score) ? Math.max(0, Math.min(1, payload.score)) : undefined;
  return { decision: normalizeDecision(payload.decision), reasons, score, provider, model };
}

function baselineModerationRules(): ModerationRules {
  return {
    blockPatterns: SOLAMENTIS_SAFETY_POLICY.blocked.map(rule => rule.description),
    reviewPatterns: SOLAMENTIS_SAFETY_POLICY.review.map(rule => rule.description),
  };
}

function mergeModerationRules(databaseRules: unknown): ModerationRules {
  const baseline = baselineModerationRules();
  const rules = databaseRules as ModerationRules | null;
  const blockPatterns = Array.isArray(rules?.blockPatterns) ? rules.blockPatterns.filter((item): item is string => typeof item === 'string') : [];
  const reviewPatterns = Array.isArray(rules?.reviewPatterns) ? rules.reviewPatterns.filter((item): item is string => typeof item === 'string') : [];
  return {
    blockPatterns: [...new Set([...baseline.blockPatterns ?? [], ...blockPatterns])],
    reviewPatterns: [...new Set([...baseline.reviewPatterns ?? [], ...reviewPatterns])],
  };
}

async function moderateWithGoogle(input: { apiKey: string; model: string; mimeType: string; base64: string; rules: ModerationRules }): Promise<ModerationResult> {
  const ai = new GoogleGenAI({ apiKey: input.apiKey });
  const instruction = [
    'You are Solamentis production image-safety moderation.',
    'Inspect the supplied image only. Do not generate or describe sexual content in detail.',
    'Classify the image into exactly one decision: allow, review, or block.',
    'block categories:',
    ...(input.rules.blockPatterns ?? []).map(item => `- ${item}`),
    'review categories:',
    ...(input.rules.reviewPatterns ?? []).map(item => `- ${item}`),
    'Use block only for a clearly matching blocked category. Use review only when the image is genuinely ambiguous or clearly matches a review category. Use allow for ordinary benign images and ordinary people, products, places, artwork, documents, or other non-prohibited content.',
    'Do not infer a violation from the mere presence of a person, skin, swimwear, medical context, historical/religious content, or a weapon unless the listed policy category is actually present.',
    'Return JSON only: {"decision":"allow|review|block","reasons":["short category reason"],"score":0.0}.',
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: input.model,
      contents: [{ role: 'user', parts: [{ text: instruction }, { inlineData: { mimeType: input.mimeType, data: input.base64 } }] }],
    });
    const text = response.text ?? '';
    if (!text) throw new ImageModerationUnavailableError('Moderation model returned no classification');
    return normalizeResult(parseModelJson(text), 'google', input.model);
  } catch (error) {
    if (error instanceof ImageModerationUnavailableError) throw error;
    throw new ImageModerationUnavailableError(error instanceof Error ? `Vision moderation unavailable: ${error.message}` : 'Vision moderation unavailable');
  }
}

export function isImageModerationUnavailable(error: unknown): boolean {
  return error instanceof ImageModerationUnavailableError;
}

export async function moderateImage(input: { mimeType: string; base64: string; userId?: string | null; jobId?: string | null; assetId?: string | null; stage: string }): Promise<ModerationResult> {
  const admin = getSupabaseAdmin();
  const { data: policy, error: policyError } = await admin.from('safety_policies').select('version,rules,moderation_provider_id,moderation_model_id').eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle();
  if (policyError || !policy) throw new Error(`Active safety policy unavailable: ${policyError?.message ?? 'missing policy'}`);
  if (!policy.moderation_provider_id || !policy.moderation_model_id) throw new Error('Active safety policy has no configured moderation provider/model');

  const config = await resolveProviderConfig(policy.moderation_provider_id, policy.moderation_model_id);
  if (config.provider !== 'google' || config.protocol !== 'google_gemini') throw new Error('Image safety moderation must use the configured Google provider');
  const apiKey = await getProviderSecret(config.provider, config.secretEnv);
  const result = await moderateWithGoogle({
    apiKey,
    model: config.model,
    mimeType: input.mimeType,
    base64: input.base64,
    rules: mergeModerationRules(policy.rules),
  });

  await recordSafetyEvent({
    userId: input.userId,
    jobId: input.jobId,
    assetId: input.assetId,
    stage: input.stage,
    decision: result.decision,
    reasons: result.reasons,
    score: result.score,
    policyVersion: Number(policy.version),
    providerId: result.provider,
    modelKey: result.model,
  });

  return result;
}
