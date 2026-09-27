import { expect, it } from 'vitest';
import { routeProfile, profileDrawing } from './route-profile';
it('retains lift transitions at the same horizontal distance', () => {
  const p = routeProfile([
    [
      [114.1, 22.3, -3],
      [114.1, 22.3, -10],
      [114.101, 22.3, -10],
    ],
  ]);
  expect(p[1].distanceM).toBe(0);
  expect(p[2].distanceM).toBeGreaterThan(100);
  expect(profileDrawing(p)?.path).toMatch(/^M28.00,24.00 L28.00,126.00/);
});
it('does not connect missing heights or disconnected paths', () => {
  const p = routeProfile([
    [
      [114.1, 22.3, 0],
      [114.101, 22.3, null],
      [114.102, 22.3, 2],
    ],
    [
      [114.3, 22.3, 5],
      [114.301, 22.3, 5],
    ],
  ]);
  expect(p[3].distanceM).toBe(p[2].distanceM);
  expect(profileDrawing(p)?.path.match(/M/g)).toHaveLength(3);
});
it('handles unknown and flat profiles without division by zero', () => {
  expect(
    profileDrawing(
      routeProfile([
        [
          [114.1, 22.3, null],
          [114.2, 22.3, null],
        ],
      ]),
    ),
  ).toBeNull();
  const flat = profileDrawing(
    routeProfile([
      [
        [114.1, 22.3, 5],
        [114.1, 22.3, 5],
      ],
    ]),
  );
  expect(flat?.path).toBe('M28.00,75.00 L28.00,75.00');
});
