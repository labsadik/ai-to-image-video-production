import type { GenerationRequest, ProviderAdapter } from './ai';
import { PROVIDER_CATALOG, type ProviderName } from '@/config/providers';

export interface ProviderRuntime extends ProviderAdapter {
  getSecret(): string;
}

const notImplemented = (name: string): ProviderRuntime => ({
  provider: name,
  getSecret() {
    const entry = PROVIDER_CATALOG[name as ProviderName];
    const value = process.env[entry?.secretEnv ?? ''];
    if (!value) throw new Error(`Missing secret for provider ${name}`);
    return value;
  },
  async generate(_request: GenerationRequest & { model: string; apiKey: string }) {
    throw new Error(`Adapter not implemented for provider ${name}`);
  },
});

export const PROVIDER_ADAPTERS: Record<ProviderName, ProviderRuntime> = {
  google: notImplemented('google'),
  openai: notImplemented('openai'),
  anthropic: notImplemented('anthropic'),
};

export function getProviderAdapter(name: ProviderName) {
  const catalog = PROVIDER_CATALOG[name];
  if (!catalog?.enabled) throw new Error(`Provider ${name} is disabled`);
  return PROVIDER_ADAPTERS[name];
}
