import { expect, it } from 'vitest';
import sample from '../../../../../fixtures/providers/popcorn-route-2026-10-17.json';
import { indoorFloorSchema, walkingRouteSchema } from '@hk/contracts';
import { classifyVenueRoute } from './venue-route-match';
import { classifyStationRoute } from './station-route-geometry';
it('uses explicit PopCorn Level G directions for a labelled 2D match without changing source heights', () => {
  const route = walkingRouteSchema.parse(sample.route),
    floors = indoorFloorSchema.array().parse(sample.floors);
  const venue = { id: floors[0].venueId, name: 'PopCorn 1', nameZh: '', kind: 'building' as const };
  const before = JSON.stringify(route.paths);
  expect(
    classifyStationRoute(route, floors, venue.id).filter((segment) => segment.levelId),
  ).toHaveLength(0);
  const matched = classifyVenueRoute(route, floors, venue).filter((segment) => segment.levelId);
  expect(matched.length).toBeGreaterThanOrEqual(2);
  expect(new Set(matched.map((segment) => segment.levelId))).toEqual(
    new Set(['1e561b6f-3d89-4605-a0d2-5d6707c25470']),
  );
  expect(matched.every((segment) => segment.match === 'direction-level')).toBe(true);
  expect(JSON.stringify(route.paths)).toBe(before);
  const unrelated = {
    ...route,
    steps: route.steps.map((step) => ({ ...step, text: 'Continue on Level G' })),
  };
  expect(
    classifyVenueRoute(unrelated, floors, venue).filter((segment) => segment.levelId),
  ).toHaveLength(0);
});
