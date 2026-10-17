import { expect, it } from 'vitest';
import { routeExit } from './route-exit';
import { classifyStationRoute } from './station-route-geometry';
import { indoorFloorSchema, indoorPointsSchema, walkingRouteSchema } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import points from '../../../../../fixtures/providers/kowloon-station-points-2026-10-17.json';
it('identifies a mapped exit on the route and rejects a point on another level', () => {
  const route = walkingRouteSchema.parse(sample.route);
  const floors = indoorFloorSchema.array().parse(sample.floors);
  const venue = { id: floors[0].venueId, name: 'Kowloon Station', nameZh: '九龍鐵路站' };
  const context = {
    venue,
    floors,
    segments: classifyStationRoute(route, floors, venue.id),
    endpointRoles: ['start' as const],
  };
  const rows = indoorPointsSchema.parse(points).points;
  expect(routeExit(route, context, rows)?.name).toBe('Exit C1');
  expect(
    routeExit(
      route,
      context,
      rows.map((point) => ({ ...point, z: point.z + 100 })),
    ),
  ).toBeUndefined();
});
