import { describe, expect, it, vi } from 'vitest';
import { FeedCache, ARRIVALS_POLICY } from './feed-cache';
import { ProviderError, type SourceResult } from '@hk/providers';

const initial = Date.parse('2026-09-13T06:16:54Z');
const source = { data: ['arrival'], sourceUpdatedAt: '2026-09-13T06:16:44.000Z' };

function makeCache(load: () => Promise<SourceResult<string[]>>, now: () => number) {
  return new FeedCache({
    provider: 'MTR',
    sourceUrl: 'https://rt.data.gov.hk/',
    load,
    now,
    policy: ARRIVALS_POLICY,
    mode: 'live',
  });
}

describe('demand feed cache', () => {
  it('coalesces simultaneous requests to one upstream operation', async () => {
    let release!: (result: SourceResult<string[]>) => void;
    const load = vi.fn(
      () =>
        new Promise<SourceResult<string[]>>((resolve) => {
          release = resolve;
        }),
    );
    const cache = makeCache(load, () => initial);
    const results = [cache.get(), cache.get(), cache.get()];
    expect(load).toHaveBeenCalledTimes(1);
    release(source);
    expect((await Promise.all(results)).map((result) => result.status)).toEqual([
      'fresh',
      'fresh',
      'fresh',
    ]);
  });

  it('retains last-good data briefly on failure, then removes expired predictions', async () => {
    let now = initial;
    const load = vi.fn().mockResolvedValueOnce(source).mockRejectedValue(new Error('offline'));
    const cache = makeCache(load, () => now);
    expect((await cache.get()).status).toBe('fresh');
    now += 31_000;
    expect(await cache.get()).toMatchObject({
      status: 'stale',
      data: ['arrival'],
      fetchedAt: new Date(initial).toISOString(),
    });
    now += 60_000;
    expect(await cache.get()).toMatchObject({ status: 'unavailable', data: null });
  });

  it('does not make an old source fresh after a successful fetch', async () => {
    const cache = makeCache(
      async () => source,
      () => initial + 120_000,
    );
    expect(await cache.get()).toMatchObject({
      status: 'unavailable',
      data: null,
      sourceUpdatedAt: source.sourceUpdatedAt,
    });
  });

  it('rejects an out-of-order update and preserves the last-good source', async () => {
    let now = initial;
    const load = vi
      .fn()
      .mockResolvedValueOnce(source)
      .mockResolvedValue({ data: ['older'], sourceUpdatedAt: '2026-09-13T06:16:00.000Z' });
    const cache = makeCache(load, () => now);
    await cache.get();
    now += 31_000;
    expect(await cache.get()).toMatchObject({
      status: 'stale',
      data: ['arrival'],
      sourceUpdatedAt: source.sourceUpdatedAt,
    });
  });

  it('marks unknown source times stale and suppresses implausible future timestamps', async () => {
    expect(
      (
        await makeCache(
          async () => ({ ...source, sourceUpdatedAt: null }),
          () => initial,
        ).get()
      ).status,
    ).toBe('stale');
    const future = new Date(initial + 10 * 60_000).toISOString();
    expect(
      (
        await makeCache(
          async () => ({ ...source, sourceUpdatedAt: future }),
          () => initial,
        ).get()
      ).data,
    ).toBeNull();
  });

  it('backs off immediate retries after a failure', async () => {
    const load = vi.fn().mockRejectedValue(new Error('offline'));
    const cache = makeCache(load, () => initial);
    await cache.get();
    await cache.get();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('honours a longer provider retry interval without freshening the last attempt time', async () => {
    let now = initial;
    const load = vi.fn().mockRejectedValue(new ProviderError('Rate limited', 60_000));
    const cache = makeCache(load, () => now);
    await cache.get();
    now += 30_000;
    expect((await cache.get()).fetchedAt).toBe(new Date(initial).toISOString());
    expect(load).toHaveBeenCalledTimes(1);
    now += 30_000;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
