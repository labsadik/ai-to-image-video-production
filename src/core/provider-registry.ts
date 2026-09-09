import type { ProviderAdapter } from './ai';
import { GoogleGeminiAdapter } from './providers/google';
import { PixazoImageAdapter } from './providers/pixazo';
import type { RuntimeProviderConfig } from '@/server/provider-config';

const GOOGLE_ADAPTER = new GoogleGeminiAdapter();
const PIXAZO_IMAGE_ADAPTER = new PixazoImageAdapter();

export function getProviderAdapter(config: RuntimeProviderConfig): ProviderAdapter {
  if (config.protocol === 'google_gemini') return GOOGLE_ADAPTER;
  if (config.protocol === 'pixazo_image') return PIXAZO_IMAGE_ADAPTER;
  throw new Error(`Unsupported AI provider protocol: ${config.protocol}`);
}
