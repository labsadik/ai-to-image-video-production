import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';
import type { ProviderName } from '@/config/providers';

interface GoogleInteractionResponse {
  id?: string;
  output_image?: { data?: string; mime_type?: string };
  steps?: Array<{ type?: string; content?: Array<{ type?: string; data?: string; mime_type?: string }> }>;
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

function imageSize(quality: GenerationRequest['quality']): string {
  if (quality === 'premium') return '4K';
  if (quality === 'standard') return '2K';
  return '1K';
}

export class GoogleGeminiAdapter implements ProviderAdapter {
  provider: ProviderName = 'google';

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    const input: Array<Record<string, unknown>> = [];
    for (const image of request.referenceImages ?? []) {
      input.push({ type: 'image', data: image.base64, mime_type: image.mimeType });
    }
    input.push({ type: 'text', text: request.prompt });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': request.apiKey,
      },
      body: JSON.stringify({
        model: request.model,
        input,
        response_format: {
          type: 'image',
          aspect_ratio: aspectRatio(request.width, request.height),
          image_size: imageSize(request.quality),
        },
      }),
    });

    const payload = (await response.json()) as GoogleInteractionResponse & { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? `Google API failed with ${response.status}`);

    if (payload.output_image?.data) {
      return {
        externalId: payload.id ?? crypto.randomUUID(),
        mimeType: payload.output_image.mime_type ?? 'image/png',
        base64: payload.output_image.data,
      };
    }

    for (const step of payload.steps ?? []) {
      for (const content of step.content ?? []) {
        if (content.type === 'image' && content.data) {
          return {
            externalId: payload.id ?? crypto.randomUUID(),
            mimeType: content.mime_type ?? 'image/png',
            base64: content.data,
          };
        }
      }
    }

    throw new Error('Google API returned no image output');
  }

  async healthCheck(apiKey: string) {
    const started = Date.now();
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': apiKey },
    });
    return {
      ok: response.ok,
      latencyMs: Date.now() - started,
      message: response.ok ? undefined : `Google models endpoint returned ${response.status}`,
    };
  }
}
