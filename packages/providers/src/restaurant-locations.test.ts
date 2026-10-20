import { expect, it, vi } from 'vitest';
import { fetchRestaurantLocations, normalizeRestaurantLocation } from './restaurant-locations';

const point = (id = 1) => ({
  geometry: { type: 'Point', coordinates: [114.1565, 22.2826] },
  properties: {
    OBJECTID: id,
    SEARCH02_EN: String(id),
    ADDRESS_EN: '17 CHIU LUNG STREET',
    LASTUPDATE: '2025-11-28',
  },
});
it('uses published geometry and preserves its update date independently from download time', () => {
  expect(normalizeRestaurantLocation(point())).toEqual({
    id: 'fehd:1',
    address: '17 CHIU LUNG STREET',
    location: { lat: 22.2826, lng: 114.1565 },
    sourceDate: '2025-11-28',
  });
  expect(normalizeRestaurantLocation({ ...point(), geometry: null })).toBeUndefined();
  expect(
    normalizeRestaurantLocation({ ...point(), geometry: { type: 'Point', coordinates: [0, 0] } }),
  ).toBeUndefined();
});

it('reads complete bounded pages and rejects duplicate or incomplete publications', async () => {
  const fetcher = vi.fn(async (url: string) => {
    const params = new URL(url).searchParams;
    if (params.has('returnCountOnly')) return Response.json({ count: 2001 });
    const offset = Number(params.get('resultOffset'));
    expect(params.get('outSR')).toBe('4326');
    return Response.json({
      type: 'FeatureCollection',
      features: Array.from({ length: offset === 0 ? 2000 : 1 }, (_, i) => point(offset + i)),
    });
  });
  const snapshot = await fetchRestaurantLocations(fetcher, () =>
    Date.parse('2026-10-19T02:00:00Z'),
  );
  expect(snapshot.records).toHaveLength(2001);
  expect(snapshot.fetchedAt).toBe('2026-10-19T02:00:00.000Z');
  expect(fetcher).toHaveBeenCalledTimes(3);
  await expect(
    fetchRestaurantLocations(async (url) =>
      Response.json(
        url.includes('returnCountOnly')
          ? { count: 1000 }
          : { type: 'FeatureCollection', features: [point(), point()] },
      ),
    ),
  ).rejects.toThrow('Duplicate');
  await expect(
    fetchRestaurantLocations(async (url) =>
      Response.json(
        url.includes('returnCountOnly')
          ? { count: 1000 }
          : { type: 'FeatureCollection', features: [point()] },
      ),
    ),
  ).rejects.toThrow('Incomplete');
});

it('deduplicates identical licence points and withholds conflicting locations', async () => {
  const run = (conflict: boolean) =>
    fetchRestaurantLocations(async (url) => {
      if (url.includes('returnCountOnly')) return Response.json({ count: 1000 });
      const features = Array.from({ length: 1000 }, (_, index) => point(index));
      features[1].properties.SEARCH02_EN = '0';
      if (conflict) features[1].geometry.coordinates = [114.2, 22.3];
      return Response.json({ type: 'FeatureCollection', features });
    });
  expect((await run(false)).records).toHaveLength(999);
  const conflicting = await run(true);
  expect(conflicting.ambiguousLicences).toBe(1);
  expect(conflicting.records.some((record) => record.id === 'fehd:0')).toBe(false);
});
