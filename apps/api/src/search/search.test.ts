import { afterEach, expect, it, vi } from 'vitest';
import { coordinateResult, type SearchResult } from '@hk/contracts';
import { RestaurantStore } from './store';
import { searchRoutes } from './routes';
import { LandsdSearch } from './landsd';
import { expectedCatalogueDate } from './collector';
import { FacilityCatalogue, FACILITY_SOURCES, normalizeFacility } from '@hk/providers';
const now = Date.parse('2026-09-26T02:00:00Z');
it('includes official facilities in unified and nearby search, with catalogue metadata', async () => {
  const fetchedAt = new Date(now).toISOString();
  const row = normalizeFacility(
    FACILITY_SOURCES[1],
    {
      geometry: { type: 'Point', coordinates: [114.18, 22.3] },
      properties: { OBJECTID: 1, NameEN: 'Test Library', NameTC: '測試圖書館' },
    },
    fetchedAt,
  );
  const facilities = new FacilityCatalogue(fetch, [
    { dataset: FACILITY_SOURCES[1].id, fetchedAt, records: [row] },
  ]);
  const app = searchRoutes(store(), undefined, 'fixture', () => now, fetch, facilities);
  expect((await (await app.request('/?q=測試圖書館')).json()).results[0].id).toBe(row.id);
  expect(
    (await (await app.request('/?q=nearby:22.3,114.18')).json()).results.some(
      (result: SearchResult) => result.id === row.id,
    ),
  ).toBe(true);
  expect((await (await app.request('/facilities')).json()).sources[1].count).toBe(1);
});
const record: SearchResult = {
  ...coordinateResult({ lat: 22.3, lng: 114.17 }),
  id: 'fehd:001',
  kind: 'restaurant',
  source: 'FEHD',
  name: 'Bakehouse',
  nameZh: '麵包店',
  address: '14 TAI WONG STREET EAST',
  district: 'Wan Chai 灣仔',
  location: null,
  locationPrecision: 'unresolved',
  sourceDate: '2026-09-26',
};
const stores: RestaurantStore[] = [];
const store = () => {
  const result = new RestaurantStore(':memory:');
  stores.push(result);
  return result;
};
afterEach(() => stores.splice(0).forEach((db) => db.close()));
it('indexes bilingual substring search and safely handles punctuation', () => {
  const db = store();
  db.publish([record], '2026-09-26', 'a', new Date(now).toISOString(), now);
  for (const q of ['bake', '麵包', '麵包店', 'Bakehouse Wan Chai'])
    expect(db.search(q, 10)[0].id).toBe(record.id);
  expect(db.search("' OR 1=1 --", 10)).toEqual([]);
  expect(db.search('%', 10)).toEqual([]);
});
it('publishes atomically and invalidates coordinates when an address changes', () => {
  const db = store();
  db.publish([record], '2026-09-26', 'a', 'download', now);
  db.locate(record.id, record.address, coordinateResult({ lat: 22.3, lng: 114.17 }), now);
  expect(db.nearby(22.3, 114.17, 10)).toHaveLength(1);
  db.publish([{ ...record, name: 'New name' }], '2026-09-26', 'b', 'download2', now + 1);
  expect(db.get(record.id)?.location).not.toBeNull();
  expect(() => db.publish([record, record], '2026-09-26', 'bad', '', now)).toThrow();
  expect(db.get(record.id)?.name).toBe('New name');
  db.publish([{ ...record, address: '20 OTHER ROAD' }], '2026-09-26', 'c', '', now + 2);
  expect(db.get(record.id)?.location).toBeNull();
  expect(() => db.publish([], '2026-09-26', 'd', '', now)).toThrow();
  expect(() => db.publish([record], '2026-09-25', 'e', '', now)).toThrow();
});
it('preserves source and import times on unchanged downloads', () => {
  const db = store();
  db.publish([record], '2026-09-26', 'a', 'first', now);
  db.publish([record], '2026-09-26', 'a', 'second', now + 86400000);
  expect(db.status(now + 86400000)).toMatchObject({
    fetchedAt: 'second',
    importedAt: new Date(now).toISOString(),
    sourceDate: '2026-09-26',
  });
  expect(db.status(now + 3 * 86400000).stale).toBe(true);
});
it('returns coordinates without touching external services and validates requests', async () => {
  const fetcher = vi.fn(async () => new Response('[]'));
  const app = searchRoutes(store(), new LandsdSearch(fetcher), 'live', () => now);
  const response = await app.request('/?q=22.3011308,114.1833802');
  expect(response.status).toBe(200);
  expect((await response.json()).results[0].location.lat).toBe(22.3011308);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await app.request('/?q=test&limit=200')).status).toBe(400);
  expect((await app.request('/restaurants/not-valid/locate', { method: 'POST' })).status).toBe(400);
  expect((await app.request('/?q=51.5,-0.12')).status).toBe(200);
});
it('keeps restaurant results on external failure and never calls live providers in fixture mode', async () => {
  const db = store();
  db.publish([record], '2026-09-26', 'a', '', now);
  const fetcher = vi.fn(async () => {
    throw new Error('Offline');
  });
  const app = searchRoutes(db, new LandsdSearch(fetcher), 'live', () => now);
  const body = await (await app.request('/?q=Bakehouse')).json();
  expect(body.results[0].id).toBe(record.id);
  expect(body.notices).toHaveLength(1);
  fetcher.mockClear();
  await searchRoutes(db, new LandsdSearch(fetcher), 'fixture', () => now).request('/?q=unknown');
  expect(fetcher).not.toHaveBeenCalled();
});
it('coalesces address requests and caches their results', async () => {
  const fetcher = vi.fn(async () => new Response('[]'));
  const client = new LandsdSearch(fetcher);
  await Promise.all([client.search('Central'), client.search('Central')]);
  await client.search('Central');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('uses 09:30 Hong Kong time for daily refresh eligibility', () => {
  expect(expectedCatalogueDate(Date.parse('2026-09-26T01:29:59Z'))).toBe('2026-09-25');
  expect(expectedCatalogueDate(Date.parse('2026-09-26T01:30:00Z'))).toBe('2026-09-26');
});

it('resolves map links through a bounded POST endpoint with fixture isolation', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://www.google.com/maps/?q=22.3,114.18' },
      }),
  );
  const app = searchRoutes(store(), undefined, 'live', () => now, fetcher);
  const request = (url: string) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const response = await app.request('/links/resolve', request('https://maps.app.goo.gl/example'));
  expect(response.status).toBe(200);
  expect((await response.json()).result.location).toEqual({ lat: 22.3, lng: 114.18 });
  expect((await app.request('/links/resolve', request('http://127.0.0.1'))).status).toBe(400);
  expect((await app.request('/links/resolve', request('x'.repeat(20000)))).status).toBe(413);
  fetcher.mockClear();
  const fixture = searchRoutes(store(), undefined, 'fixture', () => now, fetcher);
  await fixture.request('/links/resolve', request('https://maps.app.goo.gl/example'));
  expect(fetcher).not.toHaveBeenCalled();
});
