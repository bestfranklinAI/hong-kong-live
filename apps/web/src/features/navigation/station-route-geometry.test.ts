import { expect, it } from 'vitest';
import { indoorFloorSchema, type IndoorFloor, type WalkingRoute } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import {
  classifyStationRoute,
  floorContainsSegment,
  floorRoutePaths,
} from './station-route-geometry';
const ring = (x: number, y: number, w: number, h: number): Array<[number, number, number]> => [
  [x, y, 0],
  [x + w, y, 0],
  [x + w, y + h, 0],
  [x, y + h, 0],
  [x, y, 0],
];
const floor = (polygons: IndoorFloor['polygons']): IndoorFloor => ({
  id: 'level',
  venueId: 'venue',
  name: 'Test floor',
  nameZh: '',
  z: 0,
  polygons,
});
it('rejects a segment crossing a small off-centre hole that midpoint sampling would miss', () => {
  const f = floor([[ring(0, 0, 10, 10), ring(2, 4, 0.1, 2)]]);
  expect(floorContainsSegment(f, [0.5, 5], [9.5, 5])).toBe(false);
  expect(floorContainsSegment(f, [0.5, 3], [9.5, 3])).toBe(true);
});
it('does not join disconnected floor parts or shortcut concave boundaries', () => {
  expect(
    floorContainsSegment(floor([[ring(0, 0, 2, 2)], [ring(4, 0, 2, 2)]]), [1, 1], [5, 1]),
  ).toBe(false);
  const f = floor([
    [
      [
        [0, 0, 0],
        [5, 0, 0],
        [5, 1, 0],
        [1, 1, 0],
        [1, 5, 0],
        [0, 5, 0],
        [0, 0, 0],
      ],
    ],
  ]);
  expect(floorContainsSegment(f, [0.5, 4], [4, 0.5])).toBe(false);
  expect(floorContainsSegment(f, [0.5, 0.5], [4, 0.5])).toBe(true);
});
it('leaves overlapping same-height floors ambiguous rather than choosing one', () => {
  const f = floor([[ring(0, 0, 10, 10)]]);
  const route = {
    paths: [
      [
        [1, 1, 0],
        [2, 2, 0],
      ],
    ],
  } as WalkingRoute;
  const result = classifyStationRoute(route, [f, { ...f, id: 'other' }], 'venue');
  expect(result[0]).toMatchObject({ levelId: null, kind: 'unassigned' });
  expect(
    classifyStationRoute(
      {
        paths: [
          [
            [1, 1, null],
            [2, 2, 0],
          ],
        ],
      } as WalkingRoute,
      [f],
      'venue',
    ),
  ).toEqual([]);
});
it('separates the captured Kowloon platform, check-in and concourse without rewriting the route', () => {
  const route = sample.route as WalkingRoute;
  const snapshot = structuredClone(route.paths);
  const segments = classifyStationRoute(
    route,
    indoorFloorSchema.array().parse(sample.floors),
    '70953f5a-ae60-46e5-9b63-68ccef5a9329',
  );
  expect(segments.filter((segment) => segment.kind === 'floor')).toHaveLength(52);
  expect(segments.filter((segment) => segment.kind === 'level-change')).toHaveLength(3);
  const levels = [
    ...new Set(segments.flatMap((segment) => (segment.levelId ? [segment.levelId] : []))),
  ];
  expect(levels.map((id) => sample.floors.find((floor) => floor.id === id)?.name)).toEqual([
    'Platform Level 2 (Airport Express)',
    'In-town Check In Level',
    'Exit C1 Concourse Level (Tung Chung Line)',
  ]);
  const runs = floorRoutePaths(route, segments, levels[0]);
  expect(runs[0][0]).toEqual(route.paths[0][0]);
  expect(runs.every((run) => run.every((point) => point[2] === -1))).toBe(true);
  expect(route.paths).toEqual(snapshot);
});
