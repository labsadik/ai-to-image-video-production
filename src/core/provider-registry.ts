import type { ProviderAdapter } from './ai';
import { GoogleGeminiAdapter } from './providers/google';
import { HttpJsonProviderAdapter } from './providers/http-json';
import { HuggingFaceImageProviderAdapter } from './providers/huggingface';
import { OpenRouterImageProviderAdapter } from './providers/openrouter';
import { PollinationsImageProviderAdapter } from './providers/pollinations';
import { FalImageProviderAdapter } from './providers/fal';
import { IdeogramImageProviderAdapter } from './providers/ideogram';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const GOOGLE_ADAPTER = new GoogleGeminiAdapter();
const OPENROUTER_IMAGE_ADAPTER = new OpenRouterImageProviderAdapter();
const POLLINATIONS_IMAGE_ADAPTER = new PollinationsImageProviderAdapter();
const FAL_IMAGE_ADAPTER = new FalImageProviderAdapter();
const IDEOGRAM_IMAGE_ADAPTER = new IdeogramImageProviderAdapter();

export function getProviderAdapter(config: RuntimeProviderConfig): ProviderAdapter {
  if (config.protocol === 'google_gemini') return GOOGLE_ADAPTER;
  if (config.protocol === 'openrouter_images') return OPENROUTER_IMAGE_ADAPTER;
  if (config.protocol === 'pollinations_images') return POLLINATIONS_IMAGE_ADAPTER;
  if (config.protocol === 'fal_images') return FAL_IMAGE_ADAPTER;
  if (config.protocol === 'ideogram_images') return IDEOGRAM_IMAGE_ADAPTER;
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
