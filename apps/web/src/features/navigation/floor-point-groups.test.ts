import { expect, it } from 'vitest';
import { groupFloorPoints } from './floor-point-groups';
it('keeps every source point while separating dense marker hit targets', () => {
  const points = [
    { id: 'lift', x: 10, y: 10 },
    { id: 'stairs', x: 12, y: 14 },
    { id: 'exit', x: 100, y: 100 },
  ];
  const groups = groupFloorPoints(points, (p) => [p.x, p.y], 48);
  expect(groups).toHaveLength(2);
  expect(groups[0]!.points.map((p) => p.id)).toEqual(['lift', 'stairs']);
  expect(groups.flatMap((g) => g.points)).toEqual(points);
  expect(
    Math.hypot(groups[0]!.x - groups[1]!.x, groups[0]!.y - groups[1]!.y),
  ).toBeGreaterThanOrEqual(48);
});
