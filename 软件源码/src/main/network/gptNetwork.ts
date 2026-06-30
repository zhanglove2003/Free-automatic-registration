import { net } from 'electron';

export interface EndpointCheckResult {
  name: string;
  url: string;
  ok: boolean;
  status?: number;
  latencyMs: number;
  error?: string;
}

export interface NetworkCheckResult {
  checkedAt: string;
  ok: boolean;
  latencyMs: number;
  endpoints: EndpointCheckResult[];
}

export async function checkGptNetwork(): Promise<NetworkCheckResult> {
  const startedAt = Date.now();
  const endpoints = await Promise.all([
    checkEndpoint('GPT API', 'https://api.openai.com/v1/models'),
    checkEndpoint('ChatGPT Web', 'https://chatgpt.com/'),
  ]);
  const ok = endpoints.some((endpoint) => endpoint.ok);

  return {
    checkedAt: new Date().toISOString(),
    ok,
    latencyMs: Date.now() - startedAt,
    endpoints,
  };
}

async function checkEndpoint(name: string, url: string): Promise<EndpointCheckResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await net.fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    return {
      name,
      url,
      ok: response.status > 0 && response.status < 500,
      status: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name,
      url,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
