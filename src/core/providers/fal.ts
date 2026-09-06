import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';
import { fal } from '@fal-ai/client';

export class FalImageProviderAdapter implements ProviderAdapter {
  provider = 'fal';

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    fal.config({ credentials: request.apiKey });
    const result = await fal.subscribe(request.model, {
      input: { prompt: request.prompt },
      logs: false,
    });
    const data = result.data as { images?: Array<{ url?: string; content_type?: string }> };
    const image = data.images?.[0];
    if (!image?.url) throw new Error('Fal image provider returned no image URL');
    const response = await fetch(image.url);
    if (!response.ok) throw new Error(`Fal image download failed: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      externalId: crypto.randomUUID(),
      mimeType: image.content_type || response.headers.get('content-type') || 'image/png',
      base64: buffer.toString('base64'),
      providerMetadata: { protocol: 'fal_images', model: request.model },
    };
  }

  async healthCheck(apiKey: string, model = 'fal-ai/flux-2-pro') {
    if (!apiKey.trim()) return { ok: false, latencyMs: 0, message: 'FAL_KEY is not configured' };
    return { ok: true, latencyMs: 0, message: `Credential configured for ${model}` };
  }
}
