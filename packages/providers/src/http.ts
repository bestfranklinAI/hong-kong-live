export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

const MAX_RESPONSE_BYTES = 256 * 1024;

export async function fetchJson(
  url: string,
  fetcher: Fetcher,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const response = await fetcher(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(options.timeoutMs ?? 6_000),
  });
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    const seconds = retryAfter === null ? NaN : Number(retryAfter);
    const retryAfterMs = Number.isFinite(seconds)
      ? Math.max(0, seconds * 1_000)
      : retryAfter
        ? Math.max(0, Date.parse(retryAfter) - Date.now())
        : undefined;
    throw new ProviderError(
      `Source returned HTTP ${response.status}.`,
      Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    );
  }
  if (Number(response.headers.get('content-length')) > maxBytes) {
    throw new ProviderError('Source response exceeded the size limit.');
  }
  if (!response.body) throw new ProviderError('Source returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ProviderError('Source response exceeded the size limit.');
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ProviderError('Source returned invalid JSON.');
  }
}
