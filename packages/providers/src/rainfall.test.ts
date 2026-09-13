import { describe, expect, it } from 'vitest';
import { normalizeRainfall, fetchRainfall } from './rainfall';

import { syntheticRainfall } from '../../../fixtures/providers/synthetic-rainfall';
const csv = syntheticRainfall();
describe('rainfall publication', () => {
  it('preserves HKT issue and half-hour validity, raster orientation and source precision', async () => {
    const { data } = await normalizeRainfall(csv);
    expect(data.issuedAt).toBe('2026-09-13T04:00:00.000Z');
    expect(data.frames[0].startsAt).toBe(data.issuedAt);
    expect(data.frames[3].endsAt).toBe('2026-09-13T06:00:00.000Z');
    expect(data.frames[0].values[0]).toBe(12.34);
    expect(data.frames[0].values.at(-1)).toBe(0);
    expect(data.bounds[0]).toBeCloseTo(112.995);
    expect(data.bounds[3]).toBeCloseTo(23.005);
  });
  it('distinguishes missing from zero and revisions from same-issue corrections', async () => {
    const missing = await normalizeRainfall(csv.replace(',12.34', ','));
    const original = await normalizeRainfall(csv);
    expect(missing.data.frames[0].values[0]).toBeNull();
    expect(missing.data.revision).not.toBe(original.data.revision);
  });
  it.each([
    ['truncated', () => csv.slice(0, csv.lastIndexOf('\n'))],
    ['duplicate', () => csv.replace(csv.split('\n')[2], csv.split('\n')[1])],
    ['negative', () => csv.replace(',12.34', ',-999')],
    ['invalid date', () => csv.replaceAll('20260913', '20260230')],
    ['mixed issues', () => csv.replace('202609131200,202609131230', '202609131201,202609131230')],
    ['wrong validity', () => csv.replace('202609131230', '202609131231')],
  ])('rejects %s grids', async (_, make) => {
    await expect(normalizeRainfall(make())).rejects.toThrow();
  });
  it('bounds network response sizes', async () => {
    await expect(
      fetchRainfall(async () => new Response('x', { headers: { 'content-length': '5000000' } })),
    ).rejects.toThrow('size limit');
  });
});
