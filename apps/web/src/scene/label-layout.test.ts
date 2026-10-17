import { expect, it } from 'vitest';
import { layoutLabels, type LabelBox } from './label-layout';
const bounds = { width: 390, height: 844, top: 80, bottom: 140 };
const box = (id: string, x: number, y: number, priority = 1): LabelBox => ({
  id,
  x,
  y,
  priority,
  width: 120,
  height: 44,
});
it('prioritises stations and keeps touch targets apart and away from sheet/header edges', () => {
  const result = layoutLabels(
    [
      box('place', 150, 250),
      box('station', 160, 250, 2),
      box('other', 160, 340),
      box('header', 160, 110),
      box('sheet', 160, 750),
      box('edge', 20, 500),
    ],
    bounds,
    14,
  );
  expect(result.map((x) => x.id)).toEqual(['station', 'other']);
});
it('has stable ordering and a bounded label count for dense neighbourhoods', () => {
  const boxes = [box('b', 100, 200), box('a', 290, 200), box('c', 100, 400)];
  expect(layoutLabels(boxes, bounds, 2)).toEqual(layoutLabels([...boxes].reverse(), bounds, 2));
  expect(layoutLabels(boxes, bounds, 2)).toHaveLength(2);
});
