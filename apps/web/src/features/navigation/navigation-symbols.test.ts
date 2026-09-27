import { expect, it } from 'vitest';
import { instructionTransition } from './navigation-symbols';
it('recognizes explicit transition instructions without inferring equipment from place names', () => {
  expect(instructionTransition('Take the elevator')).toBe('elevator');
  expect(instructionTransition('Take the escalator')).toBe('escalator');
  expect(instructionTransition('Use the stairs')).toBe('stairs');
  expect(instructionTransition('Take the ramp')).toBe('ramp');
  expect(instructionTransition('乘搭升降機')).toBe('elevator');
  expect(instructionTransition('乘搭扶手電梯')).toBe('escalator');
  expect(instructionTransition('Go forward on Ladder Street')).toBeNull();
  expect(instructionTransition('Finish at Lift Museum')).toBeNull();
  expect(instructionTransition('Continue forward')).toBeNull();
});
