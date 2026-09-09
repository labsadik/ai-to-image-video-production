import { GoogleGenAI } from '@google/genai';
import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';
import type { ProviderName } from '@/config/providers';

const PROVIDER_TIMEOUT_MS = 90_000;

async function withProviderTimeout<T>(operation: Promise<T>, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Google provider timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function aspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.03) return '4:3';
  if (Math.abs(ratio - 1) < 0.03) return '1:1';
  if (Math.abs(ratio - 3 / 4) < 0.03) return '3:4';
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16';
  return '1:1';
}

function imageSize(quality: GenerationRequest['quality']): '1K' | '2K' | '4K' {
  if (quality === 'premium') return '4K';
  if (quality === 'standard') return '2K';
  return '1K';
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {}
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('Google image-analysis model returned invalid JSON');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(cleaned.slice(start, index + 1)) as Record<string, unknown>;
    }
  }
  throw new Error('Google image-analysis model returned invalid JSON');
}

function number01(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 20) : [];
}

export type ImageAuthenticityResult = {
  classification: 'ai_generated' | 'edited_or_composited' | 'likely_real' | 'inconclusive';
  ai_generated_probability: number;
  edited_probability: number;
  real_probability: number;
  inconclusive_probability: number;
  confidence: number;
  evidence: string[];
  possible_editing_tools: string[];
  limitations: string[];
};

function normalizeAuthenticityResult(value: Record<string, unknown>): ImageAuthenticityResult {
  const classificationValue = value.classification;
  const classification = classificationValue === 'ai_generated' || classificationValue === 'edited_or_composited' || classificationValue === 'likely_real' || classificationValue === 'inconclusive'
    ? classificationValue
    : 'inconclusive';
  return {
    classification,
    ai_generated_probability: number01(value.ai_generated_probability),
    edited_probability: number01(value.edited_probability),
    real_probability: number01(value.real_probability),
    inconclusive_probability: number01(value.inconclusive_probability),
    confidence: number01(value.confidence),
    evidence: stringArray(value.evidence),
    possible_editing_tools: stringArray(value.possible_editing_tools),
    limitations: stringArray(value.limitations),
  };
}

export async function analyzeImageWithGoogle(input: { apiKey: string; model: string; base64: string; mimeType: string; level: 'basic' | 'medium' | 'hard' }) {
  const ai = new GoogleGenAI({ apiKey: input.apiKey });
  const depth = input.level === 'basic' ? 'basic' : input.level === 'medium' ? 'medium' : 'deep forensic';
  const instruction = [
    'You are Solamentis Image Authenticity Analyzer.',
    'Analyze the supplied image for likely AI generation, digital manipulation, compositing, camera-original characteristics, visible provenance clues, and visual artifacts.',
    'This is forensic analysis, not moderation. Never claim certainty.',
    'Return ONLY JSON with exactly these keys: classification, ai_generated_probability, edited_probability, real_probability, inconclusive_probability, confidence, evidence, possible_editing_tools, limitations.',
    'classification must be one of ai_generated, edited_or_composited, likely_real, inconclusive.',
    'The four probability values and confidence must be numbers from 0 to 1.',
    'The four probability values should sum approximately to 1.0.',
    'evidence, possible_editing_tools, and limitations must be concise string arrays.',
    `Analysis depth: ${depth}.`,
  ].join('\n');

  const response = await withProviderTimeout(ai.models.generateContent({
    model: input.model,
    contents: [{
      role: 'user',
      parts: [
        { text: instruction },
        { inlineData: { mimeType: input.mimeType, data: input.base64 } },
      ],
    }],
  }));
  const text = response.text?.trim() ?? '';
  if (!text) throw new Error('Google image-analysis model returned no result');
  return { provider: 'google', model: input.model, result: normalizeAuthenticityResult(parseJsonObject(text)) };
}

export class GoogleGeminiAdapter implements ProviderAdapter {
  provider: ProviderName = 'google';

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    const ai = new GoogleGenAI({ apiKey: request.apiKey });
    const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
    for (const image of request.referenceImages ?? []) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    }

    const response = await withProviderTimeout(ai.models.generateContent({
      model: request.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio(request.width, request.height),
          imageSize: imageSize(request.quality),
        },
      },
    }));

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought) continue;
      if (part.inlineData?.data) {
        return { externalId: crypto.randomUUID(), mimeType: part.inlineData.mimeType ?? 'image/png', base64: part.inlineData.data };
      }
    }
    throw new Error('Google Gemini returned no image output');
  }

  async healthCheck(apiKey: string, model = 'gemini-3.1-flash-image') {
    const started = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey });
      await withProviderTimeout(ai.models.get({ model }), 15_000);
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Google health check failed' };
    }
  }
}
