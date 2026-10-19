import { expect, it } from 'vitest';
import { walkingRouteSchema } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import { connectionMentions, routeDifference } from './route-comparison';

const route = walkingRouteSchema.parse(sample.route);

it('counts only recognised source instructions, including Traditional Chinese wording', () => {
  const result = connectionMentions({
    ...route,
    steps: [
      { text: 'Take the elevator', distanceM: 1, durationMinutes: 1 },
      { text: '使用升降機', distanceM: 1, durationMinutes: 1 },
      { text: 'Take the stairs', distanceM: 1, durationMinutes: 1 },
      { text: 'Turn left on the concourse', distanceM: 1, durationMinutes: 1 },
    ],
  });
  expect(result).toEqual([
    { kind: 'elevator', label: 'Lift', count: 2 },
    { kind: 'stairs', label: 'Stairs', count: 1 },
  ]);
  // Supplied Z changes do not prove the presence of stairs or equipment.
  expect(connectionMentions({ ...route, steps: [] })).toEqual([]);
});

it('compares actual estimates and identifies identical paths without inventing an alternative', () => {
  const shortest = { ...route, request: { ...route.request, profile: 'shortest' as const } };
  expect(routeDifference(shortest, route)).toBe('Same mapped path as Recommended');
  const different = {
    ...shortest,
    paths: structuredClone(route.paths),
    distanceM: route.distanceM - 100,
    durationMinutes: route.durationMinutes - 2,
  };
  different.paths[0][1][0] += 0.000001;
  expect(routeDifference(different, route)).toBe(
    '100 m shorter · about 2 min quicker vs Recommended',
  );
  expect(routeDifference(route, route)).toBeNull();
  expect(routeDifference(shortest)).toBeNull();
});

it('avoids time/distance deltas when the service resolves different connection points', () => {
  const changed = {
    ...route,
    request: {
      ...route.request,
      profile: 'barrier-free' as const,
      start: { ...route.request.start, z: 4 },
    },
  };
  expect(routeDifference(changed, route)).toContain('Mapped endpoints differ');
});
