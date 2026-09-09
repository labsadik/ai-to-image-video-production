import type { ImageAuthenticityResult } from './google';

const PROVIDER_TIMEOUT_MS = 90_000;

async function withTimeout<T>(operation: Promise<T>, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Groq vision provider timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {}
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('Groq image-analysis model returned invalid JSON');
  let depth = 0; let quoted = false; let escaped = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1)) as Record<string, unknown>;
    }
  }
  throw new Error('Groq image-analysis model returned invalid JSON');
}

function number01(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 20) : []; }

function normalizeResult(value: Record<string, unknown>): ImageAuthenticityResult {
  const classificationValue = value.classification;
  const classification = classificationValue === 'ai_generated' || classificationValue === 'edited_or_composited' || classificationValue === 'likely_real' || classificationValue === 'inconclusive' ? classificationValue : 'inconclusive';
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

export async function analyzeImageWithGroq(input: { apiKey: string; model: string; base64: string; mimeType: string; level: 'basic' | 'medium' | 'hard' }) {
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
  const response = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.apiKey}` },
    body: JSON.stringify({
      model: input.model, temperature: 0, max_completion_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: instruction },
        { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.base64}` } },
      ] }],
    }),
  }));
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload ? JSON.stringify((payload as Record<string, unknown>).error) : `HTTP ${response.status}`;
    throw new Error(`Groq image-analysis request failed: ${message}`);
  }
  const choice = payload && typeof payload === 'object' && 'choices' in payload ? (payload as Record<string, unknown>).choices : null;
  const message = Array.isArray(choice) && choice[0] && typeof choice[0] === 'object' ? (choice[0] as Record<string, unknown>).message : null;
  const text = message && typeof message === 'object' ? (message as Record<string, unknown>).content : null;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Groq image-analysis model returned no result');
  return { provider: 'groq', model: input.model, result: normalizeResult(parseJsonObject(text)) };
}
