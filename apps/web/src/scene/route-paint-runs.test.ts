import { expect, it } from 'vitest';
import type { WalkingRoute, StationRouteView } from '@hk/contracts';
import { routePaintRuns } from './route-paint-runs';
it('changes emphasis without connecting gaps, deleting loops or changing source heights', () => {
  const route = {
    paths: [
      [
        [114, 22, 0],
        [114.001, 22, 1],
        [114, 22, 2],
      ],
      [
        [114.1, 22, null],
        [114.2, 22, 3],
        [114.3, 22, 4],
      ],
    ],
  } as WalkingRoute;
  const view = {
    stations: [],
    segments: [{ venueId: 'v', pathIndex: 0, segmentIndex: 1, kind: 'floor', levelId: 'l' }],
  } as StationRouteView;
  const runs = routePaintRuns(route, true, view);
  expect(runs.map((run) => run.station)).toEqual([false, true, false]);
  expect(runs[1].path).toEqual([
    [114.001, 22, 1],
    [114, 22, 2],
  ]);
  expect(runs[2].path).toEqual([
    [114.2, 22, 3],
    [114.3, 22, 4],
  ]);
});

it('splits walked geometry at the GPS estimate and preserves gaps and source elevations', () => {
  const route = {
    paths: [
      [
        [114, 22, 0],
        [114.001, 22, 10],
      ],
      [
        [114.01, 22, 20],
        [114.011, 22, 30],
      ],
    ],
  } as WalkingRoute;
  const edgeM = 111195 * Math.cos((22 * Math.PI) / 180) * 0.001;
  const runs = routePaintRuns(route, true, undefined, edgeM / 2);
  expect(runs.map((run) => run.completed)).toEqual([true, false, false]);
  expect(runs[0].path.at(-1)![0]).toBeCloseTo(114.0005);
  expect(runs[0].path.at(-1)![2]).toBeCloseTo(5);
  expect(runs[1].path[0]).toEqual(runs[0].path.at(-1));
  expect(runs[2].path[0]).toEqual([114.01, 22, 20]);
  expect(routePaintRuns(route, false).every((run) => !run.completed)).toBe(true);
});
