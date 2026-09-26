import { expect, it } from 'vitest';
import { parseCoordinates, normalizeSearchText } from './search';
it('parses decimal coordinate pairs without network or silent reversal', () => {
  expect(parseCoordinates(' (22.3011308, 114.1833802) ')).toEqual({
    kind: 'coordinates',
    location: { lat: 22.3011308, lng: 114.1833802 },
    supported: true,
    swapped: false,
  });
  expect(parseCoordinates('114.1833802，22.3011308')).toMatchObject({
    kind: 'coordinates',
    swapped: true,
    supported: true,
  });
  expect(parseCoordinates('200,300').kind).toBe('invalid');
  expect(parseCoordinates('22.3,114.2,7').kind).toBe('invalid');
  expect(parseCoordinates('51.5,-0.12')).toMatchObject({ supported: false });
  expect(parseCoordinates('Bakehouse, Wan Chai').kind).toBe('text');
  expect(parseCoordinates('NaN,114').kind).toBe('text');
});
it('normalizes full-width and mixed-script search text without stripping Chinese', () => {
  expect(normalizeSearchText('ＭＴＲ金鐘')).toBe('mtr 金鐘');
  expect(normalizeSearchText('華星冰室')).toBe('華星冰室');
});
