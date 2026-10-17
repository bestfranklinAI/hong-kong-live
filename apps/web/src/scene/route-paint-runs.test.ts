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
