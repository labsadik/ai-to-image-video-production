import type { ProviderAdapter } from './ai';
import { GoogleGeminiAdapter } from './providers/google';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const GOOGLE_ADAPTER = new GoogleGeminiAdapter();

export function getProviderAdapter(config: RuntimeProviderConfig): ProviderAdapter {
  if (config.protocol === 'google_gemini') return GOOGLE_ADAPTER;
  throw new Error(`Unsupported AI provider protocol: ${config.protocol}`);
}
