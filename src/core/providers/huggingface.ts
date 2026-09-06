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
      const image = await client.textToImage({
        model: request.model,
        inputs: request.prompt,
        parameters: {
          width: request.width,
          height: request.height,
        },
      }, {
        provider: this.config.provider === 'auto' ? undefined : this.config.provider,
        signal: controller.signal,
        outputType: 'blob',
      });

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
      await client.textToImage({ model, inputs: 'simple abstract test image' }, {
        provider: this.config.provider === 'auto' ? undefined : this.config.provider,
        signal: AbortSignal.timeout(Math.min(this.config.timeoutMs, 15000)),
        outputType: 'blob',
      });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Hugging Face health check failed' };
    }
  }
}
