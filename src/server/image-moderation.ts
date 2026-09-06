import { GoogleGenAI } from '@google/genai';
import { InferenceClient } from '@huggingface/inference';
import { getSupabaseAdmin } from './supabase-admin';
import { getProviderSecret } from './provider-secrets';
import { resolveProviderConfig } from './provider-config';
import type { SafetyDecision } from '@/core/safety';

export interface ModerationResult {
  decision: SafetyDecision;
  reasons: string[];
  score?: number;
  provider: string;
  model: string;
}

type ModerationRules = { blockPatterns?: string[]; reviewPatterns?: string[] };
type HuggingFaceProvider = 'auto' | 'baseten' | 'cerebras' | 'cohere' | 'deepinfra' | 'fal-ai' | 'featherless-ai' | 'fireworks-ai' | 'groq' | 'hf-inference' | 'novita' | 'nscale' | 'openai' | 'ovhcloud' | 'publicai' | 'replicate' | 'scaleway' | 'together' | 'wavespeed' | 'zai-org';

function normalizeDecision(value: unknown): SafetyDecision {
  return value === 'block' || value === 'review' || value === 'allow' ? value : 'review';
}
function parseModelJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned) as { decision?: unknown; reasons?: unknown; score?: unknown }; }
  catch { const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}'); if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)); throw new Error('Moderation model returned invalid JSON'); }
}
function normalizeResult(payload: { decision?: unknown; reasons?: unknown; score?: unknown }, provider: string, model: string): ModerationResult {
  const reasons = Array.isArray(payload.reasons) ? payload.reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 12) : [];
  const score = typeof payload.score === 'number' && Number.isFinite(payload.score) ? Math.max(0, Math.min(1, payload.score)) : undefined;
  return { decision: normalizeDecision(payload.decision), reasons, score, provider, model };
}

async function moderateWithGoogle(input: { apiKey: string; model: string; mimeType: string; base64: string; rules: ModerationRules }): Promise<ModerationResult> {
  const ai = new GoogleGenAI({ apiKey: input.apiKey });
  const instruction = ['You are Solamentis production image-safety moderation.','Inspect the supplied image only. Do not generate or describe sexual content in detail.','Classify the image into exactly one decision: allow, review, or block.','block categories:',...(input.rules.blockPatterns ?? []).map(item => `- ${item}`),'review categories:',...(input.rules.reviewPatterns ?? []).map(item => `- ${item}`),'Use block for a clearly matching blocked category. Use review when content is ambiguous or high-risk but not clearly blocked. Use allow only when no listed concern is present.','Return JSON only: {"decision":"allow|review|block","reasons":["short category reason"],"score":0.0}.','score must be a 0..1 risk/confidence score.'].join('\n');
  try {
    const response = await ai.models.generateContent({ model: input.model, contents: [{ role: 'user', parts: [{ text: instruction }, { inlineData: { mimeType: input.mimeType, data: input.base64 } }] }] });
    const text = response.text ?? '';
    if (!text) throw new Error('Moderation model returned no classification');
    return normalizeResult(parseModelJson(text), 'google', input.model);
  } catch (error) {
    return { decision: 'review', reasons: [error instanceof Error ? `Vision moderation unavailable: ${error.message}` : 'Vision moderation unavailable'], provider: 'google', model: input.model };
  }
}

function resolveHuggingFaceProvider(provider: string): HuggingFaceProvider | undefined {
  if (provider === 'auto') return undefined;
  return provider as HuggingFaceProvider;
}

async function moderateWithHuggingFace(input: { apiKey: string; model: string; mimeType: string; base64: string; provider: string; timeoutMs: number; rules: ModerationRules }): Promise<ModerationResult> {
  const client = new InferenceClient(input.apiKey);
  const prompt = ['You are Solamentis production image-safety moderation.','Inspect the supplied image only. Classify it into exactly one decision: allow, review, or block.','block categories:',...(input.rules.blockPatterns ?? []).map(item => `- ${item}`),'review categories:',...(input.rules.reviewPatterns ?? []).map(item => `- ${item}`),'Use block for a clearly matching blocked category. Use review for ambiguous or high-risk content. Use allow only when no listed concern is present.','Return JSON only: {"decision":"allow|review|block","reasons":["short category reason"],"score":0.0}.'].join('\n');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const out = await client.chatCompletion({ model: input.model, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.base64}` } }] }], max_tokens: 256, temperature: 0 }, { signal: controller.signal });
    const text = out.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Hugging Face moderation model returned no classification');
    return normalizeResult(parseModelJson(text), 'huggingface', input.model);
  } catch (error) {
    return { decision: 'review', reasons: [error instanceof Error ? `Vision moderation unavailable: ${error.message}` : 'Vision moderation unavailable'], provider: 'huggingface', model: input.model };
  } finally { clearTimeout(timeout); }
}

async function moderateWithHuggingFaceImageClassification(input: { apiKey: string; model: string; base64: string; provider: string; timeoutMs: number }): Promise<ModerationResult> {
  const client = new InferenceClient(input.apiKey);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const bytes = Uint8Array.from(Buffer.from(input.base64, 'base64'));
    const output = await client.imageClassification({ data: bytes.buffer, model: input.model }, {
      provider: input.provider === 'auto' ? 'hf-inference' : resolveHuggingFaceProvider(input.provider),
      signal: controller.signal,
    });
    const entries = Array.isArray(output) ? output : [];
    const nsfw = entries.find(item => item.label.toLowerCase() === 'nsfw')?.score ?? 0;
    const normal = entries.find(item => item.label.toLowerCase() === 'normal')?.score ?? 0;
    if (nsfw >= 0.75) return { decision: 'block', reasons: ['Image safety classifier detected high-probability NSFW content'], score: nsfw, provider: 'huggingface', model: input.model };
    if (nsfw >= 0.4) return { decision: 'review', reasons: ['Image safety classifier detected possible NSFW content'], score: nsfw, provider: 'huggingface', model: input.model };
    return { decision: 'allow', reasons: [], score: Math.max(normal, 1 - nsfw), provider: 'huggingface', model: input.model };
  } catch (error) {
    return { decision: 'review', reasons: [error instanceof Error ? `Image safety classifier unavailable: ${error.message}` : 'Image safety classifier unavailable'], provider: 'huggingface', model: input.model };
  } finally { clearTimeout(timeout); }
}

function getPath(value: unknown, path: string): unknown {
  let current = value; for (const segment of path.split('.')) { if (!segment) continue; if (current == null) return undefined; if (/^\d+$/.test(segment) && Array.isArray(current)) current = current[Number(segment)]; else if (typeof current === 'object') current = (current as Record<string, unknown>)[segment]; else return undefined; } return current;
}
function renderTemplate(value: unknown, values: Record<string, unknown>): unknown {
  if (typeof value === 'string') { const exact = value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/); if (exact) return values[exact[1]]; return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, name: string) => String(values[name] ?? '')); }
  if (Array.isArray(value)) return value.map(item => renderTemplate(item, values));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderTemplate(item, values)]));
  return value;
}
async function moderateWithGenericJson(input: { provider: string; baseUrl: string; timeoutMs: number; apiKey: string; model: string; mimeType: string; base64: string; requestConfig: Record<string, unknown> }): Promise<ModerationResult> {
  const cfg = (input.requestConfig.moderation ?? {}) as Record<string, unknown>; const path = typeof cfg.path === 'string' ? cfg.path : ''; if (!path) return { decision: 'review', reasons: ['Provider has no moderation endpoint configuration'], provider: input.provider, model: input.model };
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(cfg.headers && typeof cfg.headers === 'object' ? cfg.headers as Record<string, string> : {}) };
  if (cfg.auth === 'api-key') headers['x-api-key'] = input.apiKey; else if (cfg.auth === 'custom') headers[String(cfg.authHeader ?? 'authorization')] = input.apiKey; else if (cfg.auth !== 'none') headers.authorization = `Bearer ${input.apiKey}`;
  const values = { model: input.model, mimeType: input.mimeType, base64: input.base64 }; const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try { const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, { method: typeof cfg.method === 'string' ? cfg.method : 'POST', headers, body: JSON.stringify(renderTemplate(cfg.body ?? { model: '{{model}}', image: { mime_type: '{{mimeType}}', data: '{{base64}}' } }, values)), signal: controller.signal }); const text = await response.text(); let payload: unknown; try { payload = JSON.parse(text); } catch { payload = {}; } if (!response.ok) throw new Error(`Moderation provider HTTP ${response.status}`); const result = (cfg.response && typeof cfg.response === 'object' ? cfg.response : {}) as Record<string, unknown>; return normalizeResult({ decision: getPath(payload, String(result.decisionPath ?? 'decision')), reasons: getPath(payload, String(result.reasonsPath ?? 'reasons')), score: getPath(payload, String(result.scorePath ?? 'score')) }, input.provider, input.model); }
  catch (error) { return { decision: 'review', reasons: [error instanceof Error ? `Vision moderation unavailable: ${error.message}` : 'Vision moderation unavailable'], provider: input.provider, model: input.model }; }
  finally { clearTimeout(timeout); }
}

export async function moderateImage(input: { mimeType: string; base64: string; userId?: string | null; jobId?: string | null; assetId?: string | null; stage: string }): Promise<ModerationResult> {
  const admin = getSupabaseAdmin();
  const { data: policy, error: policyError } = await admin.from('safety_policies').select('version, rules, moderation_provider_id, moderation_model_id').eq('status', 'active').order('version', { ascending: false }).limit(1).maybeSingle();
  if (policyError || !policy) throw new Error(`Active safety policy unavailable: ${policyError?.message ?? 'missing policy'}`);
  if (!policy.moderation_provider_id || !policy.moderation_model_id) throw new Error('Active safety policy has no configured moderation provider/model');
  const config = await resolveProviderConfig(policy.moderation_provider_id, policy.moderation_model_id);
  const apiKey = await getProviderSecret(config.provider, config.secretEnv);
  const rules = (policy.rules ?? {}) as ModerationRules;
  const hfProvider = String((config.requestConfig as { provider?: string }).provider ?? 'auto');
  const result = config.protocol === 'google_gemini'
    ? await moderateWithGoogle({ apiKey, model: config.model, mimeType: input.mimeType, base64: input.base64, rules })
    : config.protocol === 'huggingface_vlm'
      ? await moderateWithHuggingFace({ apiKey, model: config.model, mimeType: input.mimeType, base64: input.base64, provider: hfProvider, timeoutMs: config.timeoutMs, rules })
      : config.protocol === 'huggingface_image_classification'
        ? await moderateWithHuggingFaceImageClassification({ apiKey, model: config.model, base64: input.base64, provider: hfProvider, timeoutMs: config.timeoutMs })
        : await moderateWithGenericJson({ provider: config.provider, baseUrl: config.baseUrl, timeoutMs: config.timeoutMs, apiKey, model: config.model, mimeType: input.mimeType, base64: input.base64, requestConfig: config.requestConfig as unknown as Record<string, unknown> });
  const { error: eventError } = await admin.from('safety_events').insert({ user_id: input.userId ?? null, job_id: input.jobId ?? null, asset_id: input.assetId ?? null, policy_version: Number(policy.version), stage: input.stage, decision: result.decision, reasons: result.reasons, score: result.score ?? null, provider_id: result.provider, model_key: result.model });
  if (eventError) throw new Error(`Safety event persistence failed: ${eventError.message}`);
  return result;
}
