import type { ProviderAdapter } from './ai';
import { GoogleGeminiAdapter } from './providers/google';
import { FalImageProviderAdapter } from './providers/fal';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const GOOGLE_ADAPTER = new GoogleGeminiAdapter();
const FAL_IMAGE_ADAPTER = new FalImageProviderAdapter();

export function getProviderAdapter(config: RuntimeProviderConfig): ProviderAdapter {
  if (config.protocol === 'google_gemini') return GOOGLE_ADAPTER;
  if (config.protocol === 'fal_images') return FAL_IMAGE_ADAPTER;
  throw new Error(`Unsupported AI provider protocol: ${config.protocol}`);
}
