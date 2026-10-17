import { expect, it } from 'vitest';
import { indoorFloorSchema } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import { floorDrawing, floorRouteCamera } from './floor-drawing';
it('frames the route leg rather than an entire long platform and keeps it aligned to the floor projection', () => {
  const floor = indoorFloorSchema
    .array()
    .parse(sample.floors)
    .find((floor) => floor.name === 'Platform Level 2 (Airport Express)')!;
  const path = sample.route.paths[0].slice(0, 10) as number[][];
  const view = floorRouteCamera(floor, [], [path])!;
  const display = floorDrawing(floor, []);
  const xy = path.map(display);
  expect(view.scale).toBeGreaterThan(1);
  expect(view.scale).toBeLessThanOrEqual(8);
  const centreX = (Math.min(...xy.map((p) => p[0])) + Math.max(...xy.map((p) => p[0]))) / 2;
  expect(view.x * 320).toBeCloseTo(centreX);
  expect(floorRouteCamera(floor, [], [])).toBeUndefined();
});
