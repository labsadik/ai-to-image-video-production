import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin } from './supabase-admin';
import { getProviderSecret } from './provider-secrets';
import { resolveProviderConfig } from './provider-config';
import { recordSafetyEvent } from './safety-events';
import type { SafetyDecision } from '@/core/safety';

export interface ModerationResult {
  decision: SafetyDecision;
  reasons: string[];
  score?: number;
  provider: string;
  model: string;
}

type ModerationRules = { blockPatterns?: string[]; reviewPatterns?: string[] };

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
    throw new Error('Moderation model returned invalid JSON');
  }
}

function normalizeResult(payload: { decision?: unknown; reasons?: unknown; score?: unknown }, provider: string, model: string): ModerationResult {
  const reasons = Array.isArray(payload.reasons) ? payload.reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 12) : [];
  const score = typeof payload.score === 'number' && Number.isFinite(payload.score) ? Math.max(0, Math.min(1, payload.score)) : undefined;
  return { decision: normalizeDecision(payload.decision), reasons, score, provider, model };
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
    'Use block for a clearly matching blocked category. Use review when content is ambiguous or high-risk but not clearly blocked. Use allow only when no listed concern is present.',
    'Return JSON only: {"decision":"allow|review|block","reasons":["short category reason"],"score":0.0}.',
  ].join('\n');
  try {
    const response = await ai.models.generateContent({
      model: input.model,
      contents: [{ role: 'user', parts: [{ text: instruction }, { inlineData: { mimeType: input.mimeType, data: input.base64 } }] }],
    });
    const text = response.text ?? '';
    if (!text) throw new Error('Moderation model returned no classification');
    return normalizeResult(parseModelJson(text), 'google', input.model);
  } catch (error) {
    return { decision: 'review', reasons: [error instanceof Error ? `Vision moderation unavailable: ${error.message}` : 'Vision moderation unavailable'], provider: 'google', model: input.model };
  }
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
    rules: (policy.rules ?? {}) as ModerationRules,
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
