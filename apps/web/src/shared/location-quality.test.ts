import { expect, it } from 'vitest';
import { canGuideFrom } from './location-quality';

it('requires a finite non-negative accuracy within the shared guidance threshold', () => {
  for (const accuracy of [0, 10, 60]) expect(canGuideFrom({ accuracy })).toBe(true);
  for (const accuracy of [-1, 60.1, 100, NaN, Infinity])
    expect(canGuideFrom({ accuracy })).toBe(false);
  expect(canGuideFrom(null)).toBe(false);
});
