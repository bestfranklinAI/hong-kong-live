import levels from '../../../fixtures/providers/landsd-mtr-levels-swt-2026-09-26.json';
import { expect, it, vi } from 'vitest';
import {
  IndoorCatalogue,
  normalizeIndoorFloors,
  normalizeIndoorPoints,
  normalizeIndoorStations,
} from './indoor';
import points from '../../../fixtures/providers/landsd-mtr_amenity_point-swt-2026-09-26.json';
import venues from '../../../fixtures/providers/landsd-hk-mtr-venues-swt-2026-09-26.json';
const venueId = 'd47477e8-81bb-4400-943a-e2541261bf4b';
it('keeps named levels separate and does not turn a concourse exit into a ground entrance', () => {
  const p = normalizeIndoorPoints(points, venueId);
  expect(new Set(p.map((x) => x.levelId)).size).toBe(6);
  expect(p.find((x) => x.name === 'Exit A')).toMatchObject({
    levelName: 'Concourse Level',
    category: 'entry',
  });
  expect(p.some((x) => x.category === 'elevator' && x.z < 0)).toBe(true);
  expect(normalizeIndoorStations(venues)[0].name).toBe('Sung Wong Toi Station');
});
it('rejects another venue and conflicting height metadata', () => {
  expect(() => normalizeIndoorPoints(points, 'b9b2f6ff-582d-40b0-b82d-027e950e6791')).toThrow(
    'another station',
  );
  const bad = structuredClone(points);
  bad.features[0].properties.level_z_value = 100;
  expect(() => normalizeIndoorPoints(bad, venueId)).toThrow('height');
});
it('resolves indoor references server-side, replacing submitted XY/Z and shares cached lookups', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(JSON.stringify(url.includes('mtr_venue_polygon') ? venues : points)),
  );
  const c = new IndoorCatalogue(fetcher, () => 0);
  const p = normalizeIndoorPoints(points, venueId)[0];
  const input = {
    name: 'tampered',
    lat: 22.2,
    lng: 114.1,
    z: 500,
    indoor: { venueId, pointId: p.id },
  };
  const results = await Promise.all([c.resolve(input), c.resolve(input)]);
  expect(results[0]).toMatchObject({ lat: p.lat, lng: p.lng, z: p.z });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await expect(c.points("bad' OR 1=1")).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('preserves official floor rings and joins floor IDs to point levels', () => {
  const floors = normalizeIndoorFloors(levels, venueId);
  expect(floors).toHaveLength(6);
  expect(floors.find((f) => f.name === 'Concourse Level')?.z).toBe(-3.53);
  expect(
    normalizeIndoorPoints(points, venueId).every((p) => floors.some((f) => f.id === p.levelId)),
  ).toBe(true);
  expect(floors[0].polygons[0]).toEqual(levels.features[0].geometry.coordinates);
});
it('rejects mixed venues, conflicting floor heights and unclosed rings', () => {
  expect(() => normalizeIndoorFloors(levels, 'b9b2f6ff-582d-40b0-b82d-027e950e6791')).toThrow(
    'another station',
  );
  const bad = structuredClone(levels);
  bad.features[0].geometry.coordinates[0][0][2] = 100;
  expect(() => normalizeIndoorFloors(bad, venueId)).toThrow();
  const open = structuredClone(levels);
  open.features[0].geometry.coordinates[0].pop();
  expect(() => normalizeIndoorFloors(open, venueId)).toThrow('not closed');
});
it('caches floors separately from points and coalesces repeated floor requests', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(JSON.stringify(url.includes('mtr_level_polygon') ? levels : points)),
  );
  const c = new IndoorCatalogue(fetcher, () => 0);
  const [floor, repeated, point] = await Promise.all([
    c.floors(venueId),
    c.floors(venueId),
    c.points(venueId),
  ]);
  expect(floor).toEqual(repeated);
  expect(floor.floors).toHaveLength(6);
  expect(point.points.length).toBeGreaterThan(6);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await c.floors(venueId);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
