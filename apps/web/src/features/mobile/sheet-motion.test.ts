import { expect, it } from 'vitest';
import { chooseSnap, sheetHeights, springStep } from './sheet-motion';
it('keeps peek compact while providing half and expanded snap points', () => {
  expect(sheetHeights(844, 20)).toEqual({ peek: 116, half: 379.8, full: 742.72 });
});
it('flicks advance one snap and never escape the endpoints', () => {
  const heights = sheetHeights(844);
  expect(chooseSnap(700, -0.7, 'full', heights)).toBe('half');
  expect(chooseSnap(350, -0.8, 'half', heights)).toBe('peek');
  expect(chooseSnap(160, 0.9, 'peek', heights)).toBe('half');
  expect(chooseSnap(740, 1, 'full', heights)).toBe('full');
  expect(chooseSnap(130, -1, 'peek', heights)).toBe('peek');
});
it('slow drags settle at the nearest height', () => {
  expect(chooseSnap(510, 0.1, 'peek', sheetHeights(844))).toBe('half');
  expect(chooseSnap(650, 0, 'half', sheetHeights(844))).toBe('full');
});
it('the spring converges on its target without runaway motion', () => {
  let state = { position: 128, velocity: 0 };
  for (let frame = 0; frame < 180; frame++)
    state = springStep(state.position, state.velocity, 743, 1 / 60);
  expect(state.position).toBeCloseTo(743, 2);
  expect(Math.abs(state.velocity)).toBeLessThan(0.01);
});
