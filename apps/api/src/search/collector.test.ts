import { afterEach, expect, it, vi } from 'vitest';
import { coordinateResult, type SearchResult } from '@hk/contracts';
import { RestaurantStore } from './store';
import { enrichRestaurantLocations, startRestaurantCollector } from './collector';

const now = Date.parse('2026-10-19T02:00:00Z');
const stores: RestaurantStore[] = [];
afterEach(() => {
  stores.splice(0).forEach((store) => store.close());
});
const restaurant = (id: string, address = 'G/F, 4 MONG LUNG STREET, HONG KONG'): SearchResult => ({
  ...coordinateResult({ lat: 22.28, lng: 114.22 }),
  id,
  name: id,
  kind: 'restaurant',
  source: 'FEHD',
  address,
  location: null,
  locationPrecision: 'unresolved',
});
const building: SearchResult = {
  ...coordinateResult({ lat: 22.28, lng: 114.22 }),
  id: 'landsd:building',
  source: 'LandsD',
  kind: 'address',
  address: '4-6 MONG LUNG STREET',
};
function store(records: SearchResult[]) {
  const result = new RestaurantStore(':memory:');
  stores.push(result);
  result.publish(records, '2026-10-19', 'snapshot', new Date(now).toISOString(), now);
  return result;
}

it('resumes after an individual lookup failure and reuses a matched building across shops', async () => {
  const db = store([
    restaurant('1', '1 UNKNOWN ROAD'),
    restaurant('2'),
    restaurant('3', 'SHOP 1, 4 MONG LUNG STREET, HONG KONG'),
  ]);
  const search = vi
    .fn()
    .mockRejectedValueOnce(new Error('temporary'))
    .mockResolvedValue([building]);
  expect(await enrichRestaurantLocations(db, { search }, () => now)).toBe(2);
  expect(search).toHaveBeenCalledTimes(2);
  expect(db.status(now).resolved).toBe(2);
  expect(db.pending(now, 20)).toEqual([]);
  expect(db.pending(now + 15 * 60000, 20).map((row) => row.id)).toEqual(['1']);
  expect(db.cachedLocation(restaurant('3').address, now + 31 * 86400000)).toBeUndefined();
});

it('backs off on repeated provider failures and resumes at unattempted records', async () => {
  const db = store(['1', '2', '3', '4'].map((id) => restaurant(id, `${id} TEST ROAD`)));
  const search = vi.fn().mockRejectedValue(new Error('offline'));
  await enrichRestaurantLocations(db, { search }, () => now);
  expect(search).toHaveBeenCalledTimes(3);
  expect(db.pending(now, 20).map((row) => row.id)).toEqual(['4']);
});

it('does not publish a result after the collector was stopped', async () => {
  const db = store([restaurant('1')]);
  let stopped = false;
  const search = vi.fn(async () => {
    stopped = true;
    return [building];
  });
  await enrichRestaurantLocations(
    db,
    { search },
    () => now,
    () => stopped,
  );
  expect(db.status(now).resolved).toBe(0);
  expect(db.pending(now, 20)).toHaveLength(1);
});

it('cancels an official point download when the collector stops', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const db = store([restaurant('1')]);
  let signal: AbortSignal | undefined;
  const fetcher = vi.fn(
    (_url: string, options?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        signal = options?.signal ?? undefined;
        signal?.addEventListener('abort', () => reject(signal!.reason), { once: true });
      }),
  );
  const stop = startRestaurantCollector(
    db,
    { search: vi.fn() } as unknown as import('./landsd').LandsdSearch,
    fetcher,
  );
  try {
    expect(fetcher).toHaveBeenCalledOnce();
    stop();
    expect(signal?.aborted).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(db.status(now).resolved).toBe(0);
  } finally {
    stop();
    vi.useRealTimers();
  }
});
