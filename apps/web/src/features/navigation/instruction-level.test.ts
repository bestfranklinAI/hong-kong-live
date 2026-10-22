import { expect, it } from 'vitest';
import { instructionLevel } from './instruction-level';
it('shows only levels named in the source instructions in either language', () => {
  expect(instructionLevel('Take the escalator to the footbridge')).toBe('Footbridge');
  expect(instructionLevel('沿行人天橋前行')).toBe('Footbridge');
  expect(instructionLevel('Use the underpass')).toBe('Underpass');
  expect(instructionLevel('Continue on Ground Floor')).toBe('Ground Floor');
  expect(instructionLevel('Take the lift to 1/F')).toBe('1/F');
  expect(instructionLevel('Continue on Level B2')).toBe('Level B2');
  expect(instructionLevel('前往一樓')).toBe('一樓');
  expect(instructionLevel('Continue straight for 100 m')).toBeNull();
});
