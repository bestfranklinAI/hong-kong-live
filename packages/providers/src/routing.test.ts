import { expect, it, vi } from 'vitest';
import { normalizeWalkingRoute, WalkingRouter } from './routing';
import { routeRequestSchema, type RouteRequest } from '@hk/contracts';
import sample from '../../../fixtures/providers/landsd-route-swt-2026-09-26.json';
const request: RouteRequest = {
  start: { name: 'Concourse', lng: 114.19133, lat: 22.32587, z: -3.61 },
  end: { name: 'Platform', lng: 114.19156, lat: 22.32593, z: -9.97 },
  profile: 'barrier-free',
  language: 'en',
};
it('preserves XYZ and source instructions without pretending fetch time is source time', () => {
  const route = normalizeWalkingRoute(sample, request, 0);
  expect(route.paths[0][0][2]).toBeCloseTo(-3.53);
  expect(route.paths[0][0]).toHaveLength(3);
  expect(route.steps.some((s) => s.text === 'Take the elevator')).toBe(true);
  expect(route.sourceUpdatedAt).toBeNull();
  expect(route.fetchedAt).toBe('1970-01-01T00:00:00.000Z');
  expect(route.endpointOffsetsM.every((x) => x < 10)).toBe(true);
});
it('does not interpret measure values as height and rejects misplaced connections', () => {
  const xy = structuredClone(sample);
  xy.routes.hasZ = false;
  xy.routes.features[0].geometry.hasZ = false;
  expect(normalizeWalkingRoute(xy, request, 0).paths[0][0][2]).toBeNull();
  expect(() =>
    normalizeWalkingRoute(sample, { ...request, start: { ...request.start, lng: 114.1 } }, 0),
  ).toThrow('too far');
  expect(() => normalizeWalkingRoute({ error: { message: 'no route' } }, request, 0)).toThrow(
    'No usable',
  );
});
it('discovers mode IDs, shares requests, expires cache, and does not cache failures', async () => {
  let now = 0,
    fail = false;
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('retrieveTravelModes'))
      return new Response(
        JSON.stringify({
          supportedTravelModes: [{ name: 'Barrier Free Path', id: 'verified-mode' }],
        }),
      );
    const query = new URL(url).searchParams;
    expect(query.get('travelMode')).toBe('verified-mode');
    expect(query.get('returnZ')).toBe('true');
    expect(query.get('directionsLengthUnits')).toBe('esriNAUMeters');
    return new Response(JSON.stringify(fail ? { error: {} } : sample));
  });
  const router = new WalkingRouter(fetcher, () => now);
  await Promise.all([router.route(request), router.route(request)]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await router.route(request);
  expect(fetcher).toHaveBeenCalledTimes(2);
  now = 31000;
  fail = true;
  await expect(router.route(request)).rejects.toThrow();
  fail = false;
  await router.route(request);
  expect(fetcher).toHaveBeenCalledTimes(4);
});
it('validates HK extent and profiles and omits unknown Z from requests', async () => {
  expect(
    routeRequestSchema.safeParse({ ...request, start: { ...request.start, lat: 0 } }).success,
  ).toBe(false);
  expect(routeRequestSchema.safeParse({ ...request, profile: 'rainproof' }).success).toBe(false);
  const { z: _z, ...start } = request.start;
  void _z;
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('retrieveTravelModes'))
      return new Response(
        JSON.stringify({ supportedTravelModes: [{ name: 'Barrier Free Path', id: '2' }] }),
      );
    expect(
      JSON.parse(new URL(url).searchParams.get('stops')!).features[0].geometry,
    ).not.toHaveProperty('z');
    return new Response(JSON.stringify(sample));
  });
  await new WalkingRouter(fetcher).route({ ...request, start });
});
it('rejects an indoor route that snaps to another source height', () => {
  const indoor = {
    venueId: 'd47477e8-81bb-4400-943a-e2541261bf4b',
    pointId: '60651b2d-be7c-484e-a277-3d5b83fed7be',
  };
  expect(() =>
    normalizeWalkingRoute(sample, { ...request, start: { ...request.start, z: 7.1, indoor } }, 0),
  ).toThrow('selected indoor height');
  expect(() =>
    normalizeWalkingRoute(sample, { ...request, start: { ...request.start, indoor } }, 0),
  ).not.toThrow();
});
