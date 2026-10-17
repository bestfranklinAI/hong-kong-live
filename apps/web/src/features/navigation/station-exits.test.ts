import { expect, it } from 'vitest';
import type { IndoorPoint } from '@hk/contracts';
import { exitCode, stationExits } from './station-exits';
const point = (name: string, lng: number, category: IndoorPoint['category'] = 'entry') =>
  ({ name, lng, lat: 22.28, category }) as IndoorPoint;
it('keeps every exit and sorts naturally without a destination', () => {
  const rows = stationExits([
    point('Exit A10', 114.16),
    point('Lift', 114.16, 'elevator'),
    point('Exit A2', 114.16),
  ]);
  expect(rows.map(({ point }) => point.name)).toEqual(['Exit A2', 'Exit A10']);
  expect(rows.every((row) => row.distanceM === undefined)).toBe(true);
});
it('ranks only by horizontal distance, without changing source points or assuming walking access', () => {
  const near = point('Exit B', 114.17),
    far = point('Exit A', 114.16);
  const rows = stationExits([far, near], { lat: 22.28, lng: 114.171 });
  expect(rows[0].point).toBe(near);
  expect(rows[0].distanceM).toBeGreaterThan(100);
  expect(rows[0].distanceM).toBeLessThan(110);
  expect(exitCode('Exit A2')).toBe('A2');
  expect(exitCode('Central entrance')).toBe('Central entrance');
});
