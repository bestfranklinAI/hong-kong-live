import { expect, it } from 'vitest';
import { directionNamesStation, endpointStation } from './station-endpoint';
it('recognises explicit source station instructions without mistaking West Kowloon for Kowloon', () => {
  const venue = { name: 'Kowloon Station', nameZh: '九龍鐵路站' };
  expect(
    directionNamesStation('Turn right and go on Kowloon Station Platform Level 2', venue),
  ).toBe(true);
  expect(
    directionNamesStation('Go on Hong Kong West Kowloon Station L1 Footbridge Footway', venue),
  ).toBe(false);
  expect(directionNamesStation('沿九龍站大堂直行', venue)).toBe(true);
  expect(directionNamesStation('沿香港西九龍站直行', venue)).toBe(false);
});
it('does not reinterpret an unrelated far-away coordinate label as a station reference', () => {
  expect(endpointStation({ name: 'Kowloon', lat: 22.5, lng: 114.4 })).toBeNull();
  expect(endpointStation({ name: 'Kowloon', lat: 22.304255, lng: 114.161444 })?.code).toBe('KOW');
});
