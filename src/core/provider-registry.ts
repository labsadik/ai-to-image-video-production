import type { ProviderAdapter } from './ai';
import { GoogleGeminiAdapter } from './providers/google';
import { HttpJsonProviderAdapter } from './providers/http-json';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const GOOGLE_ADAPTER = new GoogleGeminiAdapter();

export function getProviderAdapter(config: RuntimeProviderConfig): ProviderAdapter {
  if (config.protocol === 'google_gemini') return GOOGLE_ADAPTER;
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
