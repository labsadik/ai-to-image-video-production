import type { ProviderAdapter } from './ai';
import { PROVIDER_CATALOG, type ProviderName } from '@/config/providers';
import { GoogleGeminiAdapter } from './providers/google';

export interface ProviderRuntime extends ProviderAdapter {
  getSecret(): string;
}

const GOOGLE_ADAPTER = new GoogleGeminiAdapter();

const stubs: Partial<Record<ProviderName, ProviderRuntime>> = {};

export const PROVIDER_ADAPTERS: Record<ProviderName, ProviderRuntime> = {
  google: {
    ...GOOGLE_ADAPTER,
    getSecret() {
      const value = process.env[PROVIDER_CATALOG.google.secretEnv];
      if (!value) throw new Error(`Missing secret for provider google`);
      return value;
    },
  },
  openai: {
    provider: 'openai',
    getSecret() { throw new Error('OpenAI adapter is disabled'); },
    async generate() { throw new Error('OpenAI adapter is disabled'); },
    async healthCheck() { return { ok: false, latencyMs: 0, message: 'Provider disabled' }; },
  },
  anthropic: {
    provider: 'anthropic',
    getSecret() { throw new Error('Anthropic adapter is disabled'); },
    async generate() { throw new Error('Anthropic adapter is disabled'); },
    async healthCheck() { return { ok: false, latencyMs: 0, message: 'Provider disabled' }; },
  },
};

void stubs;

export function getProviderAdapter(name: ProviderName) {
  const catalog = PROVIDER_CATALOG[name];
  if (!catalog?.enabled) throw new Error(`Provider ${name} is disabled`);
  return PROVIDER_ADAPTERS[name];
}
