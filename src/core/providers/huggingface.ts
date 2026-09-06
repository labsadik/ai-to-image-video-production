import { InferenceClient } from '@huggingface/inference';
import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';

export interface HuggingFaceImageProviderConfig {
  provider: string;
  timeoutMs: number;
}

export class HuggingFaceImageProviderAdapter implements ProviderAdapter {
  constructor(private readonly config: HuggingFaceImageProviderConfig) {}

  get provider() {
    return this.config.provider;
  }

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    const client = new InferenceClient(request.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      if (request.operation === 'editImage') {
        const reference = request.referenceImages?.[0];
        if (!reference) throw new Error('An input image is required for editing');
        const data = Buffer.from(reference.base64, 'base64');
        const bytes = new Uint8Array(data.byteLength);
        bytes.set(data);
        const image = await client.imageToImage({
          model: request.model,
          provider: this.config.provider as 'auto' | 'hf-inference' | 'fal-ai',
          inputs: new Blob([bytes], { type: reference.mimeType || 'image/webp' }),
          parameters: {
            prompt: request.prompt,
            target_size: { width: request.width, height: request.height },
          },
        }, { signal: controller.signal }) as Blob;
        const buffer = Buffer.from(await image.arrayBuffer());
        return {
          externalId: crypto.randomUUID(),
          mimeType: image.type || 'image/png',
          base64: buffer.toString('base64'),
          providerMetadata: {
            protocol: 'huggingface_image_to_image',
            inferenceProvider: this.config.provider,
            model: request.model,
          },
        };
      }

      const image = await client.textToImage({
        model: request.model,
        provider: this.config.provider as 'auto' | 'hf-inference' | 'fal-ai',
        inputs: request.prompt,
        parameters: {
          width: request.width,
          height: request.height,
        },
      }, { signal: controller.signal }) as Blob;

      const buffer = Buffer.from(await image.arrayBuffer());
      const mimeType = image.type || 'image/png';
      return {
        externalId: crypto.randomUUID(),
        mimeType,
        base64: buffer.toString('base64'),
        providerMetadata: {
          protocol: 'huggingface_image',
          inferenceProvider: this.config.provider,
          model: request.model,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(apiKey: string, model?: string) {
    const started = Date.now();
    if (!model) return { ok: true, latencyMs: Date.now() - started, message: 'Model not supplied for Hugging Face health check' };
    try {
      const client = new InferenceClient(apiKey);
      await client.textToImage({ model, provider: this.config.provider as 'auto' | 'hf-inference' | 'fal-ai', inputs: 'simple abstract test image' }, {
        signal: AbortSignal.timeout(Math.min(this.config.timeoutMs, 15000)),
      });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Hugging Face health check failed' };
    }
  }
}
