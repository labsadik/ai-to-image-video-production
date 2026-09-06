import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const API_BASE = process.env.POLLINATIONS_BASE_URL?.trim() || 'https://gen.pollinations.ai';

function requiredKey() {
  const key = process.env.POLLINATIONS_API_KEY?.trim();
  if (!key) throw new Error('POLLINATIONS_API_KEY is not configured');
  return key;
}

function configuredModel(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function encodedPrompt(prompt: string) {
  return encodeURIComponent(prompt);
}

async function pollinationsJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requiredKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { payload = text; }
  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload.slice(0, 800) : JSON.stringify(payload).slice(0, 1200);
    throw new Error(`Pollinations HTTP ${response.status}: ${detail}`);
  }
  return payload;
}

export async function resolvePollinationsImageModel() {
  return configuredModel('POLLINATIONS_IMAGE_MODEL', 'flux');
}

export async function resolvePollinationsVideoModel(resolution: '720p' | '1080p') {
  return configuredModel(
    resolution === '1080p' ? 'POLLINATIONS_VIDEO_HIGH_MODEL' : 'POLLINATIONS_VIDEO_MODEL',
    resolution === '1080p' ? 'seedance-pro' : 'veo',
  );
}

export async function generatePollinationsVideo(input: {
  model: string;
  prompt: string;
  durationSeconds: number;
}) {
  const url = `${API_BASE}/video/${encodedPrompt(input.prompt)}?model=${encodeURIComponent(input.model)}&duration=${encodeURIComponent(String(input.durationSeconds))}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${requiredKey()}` } });
  if (!response.ok) {
    throw new Error(`Pollinations video HTTP ${response.status}: ${(await response.text()).slice(0, 1000)}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type') || 'video/mp4',
  };
}

export class PollinationsImageProviderAdapter implements ProviderAdapter {
  get provider() { return 'pollinations'; }

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    if ((request.referenceImages ?? []).length > 0) {
      throw new Error('Pollinations image generation currently uses text-to-image only in Solamentis; use an OpenRouter/DB route for reference-image generation.');
    }

    const payload = await pollinationsJson('/v1/images/generations', {
      method: 'POST',
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        n: 1,
        size: `${request.width}x${request.height}`,
      }),
    }) as { data?: Array<{ b64_json?: string; mime_type?: string; media_type?: string; url?: string }> };

    const image = payload.data?.[0];
    if (!image) throw new Error('Pollinations image response did not contain an image');

    if (image.b64_json) {
      return {
        externalId: crypto.randomUUID(),
        mimeType: image.mime_type || image.media_type || 'image/png',
        base64: image.b64_json,
        providerMetadata: { protocol: 'pollinations_images', model: request.model },
      };
    }

    if (image.url) {
      const media = await fetch(image.url);
      if (!media.ok) throw new Error(`Pollinations generated image download failed: HTTP ${media.status}`);
      return {
        externalId: crypto.randomUUID(),
        mimeType: media.headers.get('content-type') || 'image/png',
        base64: Buffer.from(await media.arrayBuffer()).toString('base64'),
        providerMetadata: { protocol: 'pollinations_images', model: request.model },
      };
    }

    throw new Error('Pollinations image response did not contain b64_json or url');
  }

  async healthCheck() {
    const started = Date.now();
    try {
      const response = await fetch(`${API_BASE}/v1/models`);
      return { ok: response.ok, latencyMs: Date.now() - started, message: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Pollinations health check failed' };
    }
  }
}

export function pollinationsRuntimeConfig(model: string): RuntimeProviderConfig {
  return {
    provider: 'pollinations',
    protocol: 'pollinations_images',
    baseUrl: API_BASE,
    secretEnv: 'POLLINATIONS_API_KEY',
    model,
    timeoutMs: Number(process.env.POLLINATIONS_TIMEOUT_MS ?? 180000),
    requestConfig: {},
  };
}
