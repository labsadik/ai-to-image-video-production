import type { ProviderAdapter } from './ai';
import { GoogleGeminiAdapter } from './providers/google';
import { HttpJsonProviderAdapter } from './providers/http-json';
import { HuggingFaceImageProviderAdapter } from './providers/huggingface';
import { OpenRouterImageProviderAdapter } from './providers/openrouter';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const GOOGLE_ADAPTER = new GoogleGeminiAdapter();
const OPENROUTER_IMAGE_ADAPTER = new OpenRouterImageProviderAdapter();

export function getProviderAdapter(config: RuntimeProviderConfig): ProviderAdapter {
  if (config.protocol === 'google_gemini') return GOOGLE_ADAPTER;
  if (config.protocol === 'openrouter_images') return OPENROUTER_IMAGE_ADAPTER;
  if (config.protocol === 'huggingface_image') {
    return new HuggingFaceImageProviderAdapter({
      provider: String((config.requestConfig as { provider?: string }).provider ?? 'auto'),
      timeoutMs: config.timeoutMs,
    });
  }
  if (config.protocol === 'openai_images' || config.protocol === 'generic_json') {
    return new HttpJsonProviderAdapter({
      provider: config.provider,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      requestConfig: config.requestConfig,
    });
  }
  throw new Error(`Unsupported AI provider protocol: ${config.protocol}`);
}
