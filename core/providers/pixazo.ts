import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';

const DEFAULT_TIMEOUT_MS = 90_000;

async function withTimeout<T>(operation: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Pixazo image provider timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getMediaUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const direct = [root.url, root.image_url, root.output_url, root.media_url].find((value): value is string => typeof value === 'string' && value.startsWith('http'));
  if (direct) return direct;
  const output = root.output;
  if (output && typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    const media = obj.media_url;
    if (Array.isArray(media) && typeof media[0] === 'string') return media[0];
    if (typeof media === 'string') return media;
    for (const key of ['url', 'image_url', 'output_url']) {
      if (typeof obj[key] === 'string' && String(obj[key]).startsWith('http')) return String(obj[key]);
    }
  }
  const images = root.images;
  if (Array.isArray(images) && images[0] && typeof images[0] === 'object') {
    const first = images[0] as Record<string, unknown>;
    if (typeof first.url === 'string') return first.url;
  }
  return null;
}

export class PixazoImageAdapter implements ProviderAdapter {
  provider = 'pixazo_image';

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    if ((request.referenceImages?.length ?? 0) > 0) {
      throw new Error('Pixazo free image test route currently supports text-to-image only');
    }

    const endpoint = `https://gateway.pixazo.ai/${encodeURIComponent(request.model)}/text-to-image`;
    const response = await withTimeout(fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': request.apiKey,
      },
      body: JSON.stringify({
        prompt: request.prompt,
        size: `${Math.max(512, Math.min(1024, request.width))}x${Math.max(512, Math.min(1024, request.height))}`,
      }),
    }));

    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'error' in payload ? String((payload as Record<string, unknown>).error) : `HTTP ${response.status}`;
      throw new Error(`Pixazo image request failed: ${message}`);
    }

    const mediaUrl = getMediaUrl(payload);
    if (!mediaUrl) throw new Error('Pixazo image provider returned no media URL');

    const mediaResponse = await withTimeout(fetch(mediaUrl), 60_000);
    if (!mediaResponse.ok) throw new Error(`Pixazo image download failed: HTTP ${mediaResponse.status}`);
    const mimeType = mediaResponse.headers.get('content-type')?.split(';')[0] || 'image/png';
    const buffer = Buffer.from(await mediaResponse.arrayBuffer());
    if (!buffer.length) throw new Error('Pixazo image provider returned an empty image');

    return {
      externalId: mediaUrl,
      mimeType,
      base64: buffer.toString('base64'),
      providerMetadata: { mediaUrl, model: request.model },
    };
  }

  async healthCheck(apiKey: string, model = 'flux') {
    const started = Date.now();
    try {
      const response = await withTimeout(fetch(`https://gateway.pixazo.ai/${encodeURIComponent(model)}/text-to-image`, {
        method: 'OPTIONS',
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      }), 10_000);
      return { ok: response.status < 500, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Pixazo health check failed' };
    }
  }
}
