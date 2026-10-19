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

it('uses directional symbols only for explicit source manoeuvres', async () => {
  const { instructionSymbol } = await import('./navigation-symbols');
  expect(instructionSymbol('Turn left onto Queen’s Road')).toBe('left');
  expect(instructionSymbol('Keep right on the footbridge')).toBe('right');
  expect(instructionSymbol('Go forward on the pavement')).toBe('straight');
  expect(instructionSymbol('向左轉')).toBe('left');
  expect(instructionSymbol('Take the elevator to Level 2')).toBe('elevator');
  expect(instructionSymbol('Arrive at Right House')).toBe('walk');
});
