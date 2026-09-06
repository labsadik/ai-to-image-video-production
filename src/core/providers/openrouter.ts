import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const API_BASE = 'https://openrouter.ai/api/v1';

type ImageModelRecord = {
  id: string;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};

type VisionModelRecord = {
  id: string;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};

type VideoModelRecord = {
  id: string;
  supported_durations?: number[];
  supported_resolutions?: string[];
  supported_aspect_ratios?: string[];
  generate_audio?: boolean;
  pricing_skus?: Record<string, unknown>;
};

function requiredKey() {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured');
  return key;
}

async function openRouterFetch(path: string, init: RequestInit = {}) {
  const key = requiredKey();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'https://solamentis.app',
      'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Solamentis',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { payload = text; }
  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload.slice(0, 600) : JSON.stringify(payload).slice(0, 1200);
    throw new Error(`OpenRouter HTTP ${response.status}: ${detail}`);
  }
  return payload;
}

function configuredModel(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export async function resolveOpenRouterImageModel() {
  const configured = configuredModel('OPENROUTER_IMAGE_MODEL');
  if (configured) return configured;
  const payload = await openRouterFetch('/images/models');
  const models = Array.isArray((payload as { data?: unknown[] })?.data) ? (payload as { data: ImageModelRecord[] }).data : [];
  const preferred = ['bytedance-seed/seedream-4.5', 'google/gemini-3.1-flash-image', 'google/gemini-3-pro-image'];
  return preferred.find(id => models.some(model => model.id === id)) ?? models[0]?.id ?? (() => { throw new Error('OpenRouter has no image generation model available'); })();
}

export async function resolveOpenRouterVisionModel() {
  const configured = configuredModel('OPENROUTER_ANALYSIS_MODEL');
  if (configured) return configured;
  const payload = await openRouterFetch('/models?input_modalities=image');
  const models = Array.isArray((payload as { data?: unknown[] })?.data) ? (payload as { data: VisionModelRecord[] }).data : [];
  const freePreferred = models.find(model => model.id.endsWith(':free'));
  return freePreferred?.id ?? models[0]?.id ?? (() => { throw new Error('OpenRouter has no vision model available'); })();
}

export async function resolveOpenRouterVideoModel(durationSeconds: number, resolution: '720p' | '1080p') {
  const configured = configuredModel(resolution === '1080p' ? 'OPENROUTER_VIDEO_HIGH_MODEL' : 'OPENROUTER_VIDEO_MODEL');
  const payload = await openRouterFetch('/videos/models');
  const models = Array.isArray((payload as { data?: unknown[] })?.data) ? (payload as { data: VideoModelRecord[] }).data : [];
  const supports = (model: VideoModelRecord) => {
    const durations = model.supported_durations ?? [];
    const resolutions = model.supported_resolutions ?? [];
    return durations.includes(durationSeconds) && (resolutions.length === 0 || resolutions.includes(resolution));
  };
  if (configured) {
    const explicit = models.find(model => model.id === configured);
    if (!explicit || !supports(explicit)) throw new Error(`Configured OpenRouter video model ${configured} does not support ${durationSeconds}s at ${resolution}`);
    return explicit.id;
  }
  const preferred = resolution === '1080p'
    ? ['alibaba/wan-3.0', 'bytedance/seedance-2.0']
    : ['alibaba/wan-3.0', 'bytedance/seedance-2.0-mini', 'bytedance/seedance-2.0-fast', 'google/veo-3.1-lite'];
  return preferred.find(id => models.some(model => model.id === id && supports(model)))
    ?? models.find(supports)?.id
    ?? (() => { throw new Error(`OpenRouter has no video model supporting ${durationSeconds}s at ${resolution}`); })();
}

export async function analyzeImageWithOpenRouter(input: { base64: string; mimeType: string; level: 'basic' | 'medium' | 'hard' }) {
  const model = await resolveOpenRouterVisionModel();
  const depth = input.level === 'basic' ? 'basic' : input.level === 'medium' ? 'medium' : 'deep forensic';
  const system = `You are Solamentis Image Authenticity Analyzer. Analyze the supplied image for likely AI generation, digital manipulation, compositing, camera-original characteristics, metadata/provenance clues when observable, and visual artifacts. This is forensic analysis, not moderation. Never claim certainty. Return strict JSON with keys classification, ai_generated_probability, edited_probability, real_probability, confidence, evidence, possible_editing_tools, limitations. classification must be one of ai_generated, edited_or_composited, likely_real, inconclusive. Analysis depth: ${depth}.`;
  const payload = await openRouterFetch('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: [
          { type: 'text', text: `Perform a ${depth} image authenticity analysis. Return JSON only.` },
          { type: 'image_url', image_url: { url: `data:${input.mimeType};base64,${input.base64}` } },
        ] },
      ],
    }),
  }) as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> };
  const raw = payload.choices?.[0]?.message?.content;
  const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(part => part.text ?? '').join('\n') : '';
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? text;
  try {
    return { provider: 'openrouter', model, result: JSON.parse(fenced) as Record<string, unknown> };
  } catch {
    return { provider: 'openrouter', model, result: { classification: 'inconclusive', confidence: 0, evidence: [text.slice(0, 2000)], limitations: ['The selected analysis model did not return valid structured JSON.'] } };
  }
}

export async function submitOpenRouterVideo(input: { model: string; prompt: string; durationSeconds: number; resolution: '720p' | '1080p'; aspectRatio: string; generateAudio: false }) {
  return await openRouterFetch('/videos', {
    method: 'POST',
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      duration: input.durationSeconds,
      resolution: input.resolution,
      aspect_ratio: input.aspectRatio,
      generate_audio: false,
    }),
  }) as { id?: string; polling_url?: string; status?: string; generation_id?: string; error?: string };
}

export async function getOpenRouterVideo(jobId: string) {
  return await openRouterFetch(`/videos/${encodeURIComponent(jobId)}`) as { id?: string; status?: string; error?: string; unsigned_urls?: string[]; generation_id?: string };
}

export async function downloadOpenRouterVideo(jobId: string) {
  const key = requiredKey();
  const response = await fetch(`${API_BASE}/videos/${encodeURIComponent(jobId)}/content`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'https://solamentis.app',
      'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Solamentis',
    },
  });
  if (!response.ok) throw new Error(`OpenRouter video content HTTP ${response.status}: ${await response.text()}`);
  return { buffer: Buffer.from(await response.arrayBuffer()), mimeType: response.headers.get('content-type') || 'video/mp4' };
}

export class OpenRouterImageProviderAdapter implements ProviderAdapter {
  get provider() { return 'openrouter'; }

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    const body: Record<string, unknown> = { model: request.model, prompt: request.prompt, n: 1 };
    const references = request.referenceImages ?? [];
    if (references.length) body.input_references = references.map(reference => ({ type: 'image_url', image_url: { url: `data:${reference.mimeType};base64,${reference.base64}` } }));
    const payload = await openRouterFetch('/images', { method: 'POST', body: JSON.stringify(body) }) as { data?: Array<{ b64_json?: string; media_type?: string }> };
    const image = payload.data?.[0];
    if (!image?.b64_json) throw new Error('OpenRouter image response did not contain an image');
    return { externalId: crypto.randomUUID(), mimeType: image.media_type || 'image/png', base64: image.b64_json, providerMetadata: { protocol: 'openrouter_images', testMode: true, model: request.model } };
  }

  async healthCheck() {
    const started = Date.now();
    try {
      await openRouterFetch('/models?output_modalities=image');
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'OpenRouter health check failed' };
    }
  }
}

export function openRouterRuntimeConfig(model: string): RuntimeProviderConfig {
  return {
    provider: 'openrouter',
    protocol: 'openrouter_images',
    baseUrl: API_BASE,
    secretEnv: 'OPENROUTER_API_KEY',
    model,
    timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 180000),
    requestConfig: {},
  };
}
