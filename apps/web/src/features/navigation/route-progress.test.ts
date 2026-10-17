import { expect, it } from 'vitest';
import { walkingRouteSchema } from '@hk/contracts';
import fixture from '../../../../../fixtures/providers/admiralty-routing-audit-2026-09-26.json';
import { routeProgress } from './route-progress';
const route = () => walkingRouteSchema.parse(fixture.routes['eal-ground']);
it('estimates progress along real segments without joining disconnected paths', () => {
  const value = route();
  value.paths = [
    [
      [114.16, 22.3, 0],
      [114.161, 22.3, 4],
    ],
    [
      [114.17, 22.3, 8],
      [114.171, 22.3, 10],
    ],
  ];
  const middle = routeProgress(value, { lng: 114.1605, lat: 22.3, accuracy: 5 });
  expect(middle?.offRoute).toBe(false);
  expect(middle?.z).toBeCloseTo(2, 4);
  expect(middle?.remainingM).toBeCloseTo(value.distanceM * 0.75, 0);
  expect(routeProgress(value, { lng: 114.165, lat: 22.3, accuracy: 5 })?.offRoute).toBe(true);
});
it('does not claim arrival from an inaccurate fix', () => {
  const value = route();
  value.paths = [
    [
      [114.16, 22.3, 0],
      [114.161, 22.3, 4],
    ],
  ];
  expect(routeProgress(value, { lng: 114.161, lat: 22.3, accuracy: 80 })?.arrived).toBe(false);
  expect(routeProgress(value, { lng: 114.161, lat: 22.3, accuracy: 5 })?.arrived).toBe(true);
});
it('keeps unknown source elevation unknown', () => {
  const value = route();
  value.paths = [
    [
      [114.16, 22.3, null],
      [114.161, 22.3, 4],
    ],
  ];
  expect(routeProgress(value, { lng: 114.1605, lat: 22.3, accuracy: 5 })?.z).toBeNull();
});
