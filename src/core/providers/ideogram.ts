import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';

export class IdeogramImageProviderAdapter implements ProviderAdapter {
  provider = 'ideogram';

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    const response = await fetch('https://api.ideogram.ai/v1/ideogram-v4/generate', {
      method: 'POST',
      headers: { 'Api-Key': request.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_request: {
          model: 'V_4',
          prompt: request.prompt,
          magic_prompt: 'AUTO',
          num_images: 1,
        },
      }),
    });
    const text = await response.text();
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { payload = text; }
    if (!response.ok) {
      const detail = typeof payload === 'string' ? payload.slice(0, 600) : JSON.stringify(payload).slice(0, 1200);
      throw new Error(`Ideogram HTTP ${response.status}: ${detail}`);
    }
    const imageUrl = (payload as { data?: Array<{ url?: string }> })?.data?.[0]?.url;
    if (!imageUrl) throw new Error('Ideogram returned no image URL');
    const image = await fetch(imageUrl);
    if (!image.ok) throw new Error(`Ideogram image download failed: HTTP ${image.status}`);
    const buffer = Buffer.from(await image.arrayBuffer());
    return {
      externalId: crypto.randomUUID(),
      mimeType: image.headers.get('content-type') || 'image/png',
      base64: buffer.toString('base64'),
      providerMetadata: { protocol: 'ideogram_images', model: 'V_4' },
    };
  }

  async healthCheck(apiKey: string) {
    if (!apiKey.trim()) return { ok: false, latencyMs: 0, message: 'IDEOGRAM_API_KEY is not configured' };
    return { ok: true, latencyMs: 0, message: 'Ideogram credential configured' };
  }
}
