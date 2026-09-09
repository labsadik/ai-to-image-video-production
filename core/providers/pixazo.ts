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
  for (const key of ['url', 'image_url', 'output_url', 'media_url']) {
    const value = root[key];
    if (typeof value === 'string' && value.startsWith('http')) return value;
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].startsWith('http')) return value[0];
  }
  const output = root.output;
  if (output && typeof output === 'object') return getMediaUrl(output);
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
      body: JSON.stringify({ prompt: request.prompt }),
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': apiKey,
        },
        body: JSON.stringify({ prompt: 'health check: a simple blue circle on white background' }),
      }), 15_000);
      return { ok: response.ok, latencyMs: Date.now() - started, message: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Pixazo health check failed' };
    }
  }
}
