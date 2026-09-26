import { expect, it } from 'vitest';
import { shouldShowTrainBadge } from './train-presentation';
const radians = (degrees: number) => (degrees * Math.PI) / 180;
it('keeps carriages overhead and upright badges at street-facing camera angles', () => {
  expect(shouldShowTrainBadge(radians(-90), true)).toBe(false);
  expect(shouldShowTrainBadge(radians(-70), false)).toBe(false);
  expect(shouldShowTrainBadge(radians(-30), false)).toBe(true);
  expect(shouldShowTrainBadge(0, false)).toBe(true);
});
it('holds the existing presentation through small camera oscillations', () => {
  expect(shouldShowTrainBadge(radians(-60), true)).toBe(true);
  expect(shouldShowTrainBadge(radians(-60), false)).toBe(false);
  expect(shouldShowTrainBadge(radians(-66), true)).toBe(false);
  expect(shouldShowTrainBadge(radians(-54), false)).toBe(true);
});
