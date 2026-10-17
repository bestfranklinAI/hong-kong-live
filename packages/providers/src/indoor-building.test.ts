import { expect, it, vi } from 'vitest';
import sample from '../../../fixtures/providers/landsd-building-sample-2026-10-17.json';
import { IndoorCatalogue, normalizeIndoorFloors, normalizeIndoorPoints } from './indoor';
import { normalizeIndoorLayout } from './indoor-layout';
import type { Fetcher } from './http';
const id = sample.venue.features[0].properties.venue_id;
it('preserves captured building floor identity and level heights across independent layers', () => {
  const floor = normalizeIndoorFloors(sample.floors, id)[0];
  expect(floor.name).toBe('GF');
  const points = normalizeIndoorPoints(sample.points, id);
  expect(points.length).toBeGreaterThan(0);
  expect(
    points.every((point) => point.levelId === floor.id && Math.abs(point.z - floor.z) < 0.25),
  ).toBe(true);
  expect(normalizeIndoorLayout(sample.units, id, 'unit')[0].levelId).toBe(floor.id);
  expect(normalizeIndoorLayout(sample.openings, id, 'opening')[0].levelId).toBe(floor.id);
});
it('uses only fixed building layers and keeps station and building caches separate', async () => {
  const fetcher = vi.fn<Fetcher>(async (url) => {
    const layer = new URL(url).pathname.split('/').at(-1);
    const data =
      layer === 'venue_polygon'
        ? sample.venue
        : layer === 'level_polygon'
          ? sample.floors
          : layer === 'amenity_point'
            ? sample.points
            : layer === 'unit_polygon'
              ? sample.units
              : sample.openings;
    return new Response(JSON.stringify(data));
  });
  const catalogue = new IndoorCatalogue(fetcher, () => 0);
  expect((await catalogue.buildings()).venues[0]).toMatchObject({
    name: 'Billion Centre',
    kind: 'building',
  });
  const venue = (await catalogue.buildings()).venues[0];
  expect(venue.location?.lat).toBeGreaterThan(22);
  expect(venue.location?.lat).toBeLessThan(23);
  expect(venue.location?.lng).toBeGreaterThan(114);
  expect(venue.location?.lng).toBeLessThan(115);
  await catalogue.floors(id, 'building');
  await catalogue.points(id, 'building');
  await catalogue.layout(id, 'building');
  expect(fetcher.mock.calls.map(([url]) => new URL(url).pathname.split('/').at(-1))).toEqual([
    'venue_polygon',
    'level_polygon',
    'amenity_point',
    'unit_polygon',
    'opening_line',
  ]);
  await catalogue.floors(id, 'building');
  expect(fetcher).toHaveBeenCalledTimes(5);
  await expect(catalogue.floors("bad' OR 1=1", 'building')).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(5);
});
