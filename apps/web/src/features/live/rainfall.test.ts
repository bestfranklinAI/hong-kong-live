import { expect, it } from 'vitest';
import type { Feed, Rainfall } from '@hk/contracts';
import { usableRainfall } from './use-rainfall';
import { rainfallColor } from './rainfall-colors';
it('uses transparent zero, distinct missing and discrete forecast bins', () => {
  expect(rainfallColor(0)[3]).toBe(0);
  expect(rainfallColor(null)[3]).toBeGreaterThan(0);
  expect(rainfallColor(1)).not.toEqual(rainfallColor(0.99));
});
it('expires cached browser forecasts even when offline', () => {
  const issuedAt = '2026-09-13T04:00:00.000Z';
  const data = { issuedAt } as Rainfall;
  const feed = { data, status: 'fresh', fetchedAt: issuedAt } as Feed<Rainfall>;
  expect(usableRainfall(feed, Date.parse(issuedAt) + 60_000)).toBe(data);
  expect(usableRainfall(feed, Date.parse(issuedAt) + 120 * 60_000)).toBeNull();
  expect(usableRainfall(feed, Date.parse(issuedAt) - 180_000)).toBeNull();
  expect(usableRainfall({ ...feed, status: 'unavailable' }, Date.parse(issuedAt))).toBeNull();
});
