import { describe, expect, it } from 'vitest';
import { fetchJson } from './http';

describe('bounded source transport', () => {
  it('retains provider Retry-After hints for request backoff', async () => {
    await expect(
      fetchJson(
        'https://example.test/',
        async () =>
          new Response('', {
            status: 429,
            headers: { 'Retry-After': '120' },
          }),
      ),
    ).rejects.toMatchObject({ retryAfterMs: 120_000 });
  });

  it('stops oversized bodies without relying on Content-Length', async () => {
    await expect(
      fetchJson('https://example.test/', async () => new Response('x'.repeat(256 * 1024 + 1))),
    ).rejects.toThrow('size limit');
  });

  it('rejects HTML and returns parsed JSON for valid responses', async () => {
    await expect(
      fetchJson('https://example.test/', async () => new Response('<html>outage</html>')),
    ).rejects.toThrow('invalid JSON');
    await expect(
      fetchJson('https://example.test/', async () => Response.json({ ready: true })),
    ).resolves.toEqual({ ready: true });
  });
});
