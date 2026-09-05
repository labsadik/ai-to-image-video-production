import type { GenerationRequest, ProviderAdapter, ProviderResult } from '@/core/ai';

type JsonPath = string;

export interface HttpJsonProviderConfig {
  provider: string;
  baseUrl: string;
  timeoutMs: number;
  requestConfig: {
    path?: string;
    healthPath?: string;
    method?: string;
    auth?: 'bearer' | 'api-key' | 'custom' | 'none';
    authHeader?: string;
    headers?: Record<string, string>;
    body?: unknown;
    response?: {
      base64Path?: JsonPath;
      mimeTypePath?: JsonPath;
      externalIdPath?: JsonPath;
    };
  };
}

function getPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split('.')) {
    if (!segment) continue;
    if (current == null) return undefined;
    if (/^\d+$/.test(segment) && Array.isArray(current)) current = current[Number(segment)];
    else if (typeof current === 'object') current = (current as Record<string, unknown>)[segment];
    else return undefined;
  }
  return current;
}

function placeholder(name: string, request: GenerationRequest & { model: string }): unknown {
  switch (name) {
    case 'model': return request.model;
    case 'prompt': return request.prompt;
    case 'width': return request.width;
    case 'height': return request.height;
    case 'size': return request.size;
    case 'quality': return request.quality;
    case 'operation': return request.operation;
    case 'referenceImages': return request.referenceImages ?? [];
    default: throw new Error(`Unsupported provider template variable: ${name}`);
  }
}

function renderTemplate(value: unknown, request: GenerationRequest & { model: string }): unknown {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
    if (exact) return placeholder(exact[1], request);
    return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, name: string) => String(placeholder(name, request)));
  }
  if (Array.isArray(value)) return value.map(item => renderTemplate(item, request));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderTemplate(item, request)]));
  }
  return value;
}

function joinUrl(baseUrl: string, path = '') {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function authHeaders(config: HttpJsonProviderConfig['requestConfig'], apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(config.headers ?? {}) };
  if (config.auth === 'bearer') headers.authorization = `Bearer ${apiKey}`;
  else if (config.auth === 'api-key') headers['x-api-key'] = apiKey;
  else if (config.auth === 'custom') headers[config.authHeader ?? 'authorization'] = apiKey;
  return headers;
}

export class HttpJsonProviderAdapter implements ProviderAdapter {
  constructor(private readonly config: HttpJsonProviderConfig) {}

  get provider() {
    return this.config.provider;
  }

  async generate(request: GenerationRequest & { model: string; apiKey: string }): Promise<ProviderResult> {
    const cfg = this.config.requestConfig;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(joinUrl(this.config.baseUrl, cfg.path), {
        method: cfg.method ?? 'POST',
        headers: authHeaders(cfg, request.apiKey),
        body: JSON.stringify(renderTemplate(cfg.body ?? { model: '{{model}}', prompt: '{{prompt}}' }, request)),
        signal: controller.signal,
      });

      const text = await response.text();
      let payload: unknown;
      try { payload = JSON.parse(text); } catch { payload = text; }
      if (!response.ok) {
        const detail = typeof payload === 'string' ? payload.slice(0, 500) : JSON.stringify(payload).slice(0, 1000);
        throw new Error(`Provider ${this.provider} HTTP ${response.status}: ${detail}`);
      }

      const paths = cfg.response ?? {};
      const encoded = getPath(payload, paths.base64Path ?? 'data.0.b64_json');
      const mime = getPath(payload, paths.mimeTypePath ?? 'data.0.mime_type');
      const external = getPath(payload, paths.externalIdPath ?? 'id');
      if (typeof encoded !== 'string') throw new Error(`Provider ${this.provider} response did not contain an image at ${paths.base64Path ?? 'data.0.b64_json'}`);

      return {
        externalId: typeof external === 'string' ? external : crypto.randomUUID(),
        mimeType: typeof mime === 'string' && mime ? mime : 'image/png',
        base64: encoded,
        providerMetadata: { protocol: 'generic_json' },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck(apiKey: string) {
    const started = Date.now();
    try {
      const cfg = this.config.requestConfig;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(this.config.timeoutMs, 15000));
      try {
        const response = await fetch(joinUrl(this.config.baseUrl, cfg.healthPath ?? cfg.path), {
          method: 'HEAD',
          headers: authHeaders(cfg, apiKey),
          signal: controller.signal,
        });
        return { ok: response.ok, latencyMs: Date.now() - started, message: response.ok ? undefined : `HTTP ${response.status}` };
      } finally { clearTimeout(timeout); }
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: error instanceof Error ? error.message : 'Provider health check failed' };
    }
  }
}
