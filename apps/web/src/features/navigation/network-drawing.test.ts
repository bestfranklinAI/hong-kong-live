import { expect, it } from 'vitest';
import type { NetworkSegment } from '@hk/contracts';
import { networkDrawing } from './network-drawing';
const segment: NetworkSegment = {
  id: '1',
  kind: 'Lift',
  cover: 'unknown',
  enabled: null,
  floorId: null,
  accessTimeId: null,
  amendedAt: null,
  paths: [
    [
      [114.16, 22.28, -8],
      [114.16, 22.28, 8],
    ],
  ],
};
it('separates equal-XY source levels and leaves unknown heights disconnected', () => {
  const plan = networkDrawing([segment], false)[0].d;
  const height = networkDrawing([segment], true)[0].d;
  expect(plan).toBe('M180.00,120.00 L180.00,120.00');
  expect(height).not.toBe(plan);
  expect(height).not.toMatch(/NaN|Infinity/);
  const gap = {
    ...segment,
    paths: [[...segment.paths[0], [114.16, 22.28, null], ...segment.paths[0]]],
  } as NetworkSegment;
  expect(networkDrawing([gap], true)[0].d.match(/M/g)).toHaveLength(2);
  expect(
    networkDrawing(
      [
        {
          ...segment,
          paths: [
            [
              [114.16, 22.28, null],
              [114.17, 22.28, null],
            ],
          ],
        },
      ],
      true,
    ),
  ).toEqual([]);
});
it('shows the solver route as a horizontal reference only, without joining its unknown height datum', () => {
  const route: NetworkSegment['paths'] = [
    [
      [114.159, 22.279, 100],
      [114.161, 22.281, 120],
    ],
  ];
  expect(networkDrawing([segment], false, route).at(-1)?.segment).toBeNull();
  expect(networkDrawing([segment], true, route)).toEqual(networkDrawing([segment], true));
});
