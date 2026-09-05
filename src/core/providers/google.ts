import { GoogleGenAI } from '@google/genai';
import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';
import type { ProviderName } from '@/config/providers';

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

export class GoogleGeminiAdapter implements ProviderAdapter {
  provider: ProviderName = 'google';

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    const ai = new GoogleGenAI({ apiKey: request.apiKey });
    const parts: Array<Record<string, unknown>> = [{ text: request.prompt }];
    for (const image of request.referenceImages ?? []) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    }

    const response = await ai.models.generateContent({
      model: request.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio(request.width, request.height),
          imageSize: imageSize(request.quality),
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought) continue;
      if (part.inlineData?.data) {
        return { externalId: crypto.randomUUID(), mimeType: part.inlineData.mimeType ?? 'image/png', base64: part.inlineData.data };
      }
    }
    throw new Error('Google Gemini returned no image output');
  }

  async healthCheck(apiKey: string) {
    const started = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.get({ model: 'gemini-3.1-flash-image' });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Google health check failed' };
    }
  }
}
