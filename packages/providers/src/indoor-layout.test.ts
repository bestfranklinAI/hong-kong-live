import { expect, it, vi } from 'vitest';
import units from '../../../fixtures/providers/landsd-mtr-units-swt-2026-09-26.json';
import openings from '../../../fixtures/providers/landsd-mtr-openings-swt-2026-09-26.json';
import { normalizeIndoorLayout } from './indoor-layout';
import { IndoorCatalogue } from './indoor';
const venue = 'd47477e8-81bb-4400-943a-e2541261bf4b';
it('retains source level identity, service openings and unit geometry without claiming access', () => {
  const u = normalizeIndoorLayout(units, venue, 'unit');
  const o = normalizeIndoorLayout(openings, venue, 'opening');
  expect(u).toHaveLength(85);
  expect(o).toHaveLength(195);
  expect(u[0].lines).toEqual(units.features[0].geometry.coordinates);
  expect(o[0].id).toBe(openings.features[0].properties.opening_id.toLowerCase());
  expect(o.filter((r) => r.category === 'service')).toHaveLength(6);
  expect(o[0].levelId).toBe(openings.features[0].properties.level_id);
});
it('rejects mismatched levels, foreign venues and malformed geometry', () => {
  const bad = structuredClone(units);
  bad.features[0].properties.level_z_value = 400;
  expect(() => normalizeIndoorLayout(bad, venue, 'unit')).toThrow('source level');
  expect(() => normalizeIndoorLayout(units, 'wrong', 'unit')).toThrow('another station');
  const line = structuredClone(openings);
  line.features[0].geometry.coordinates[0][0] = 0;
  expect(() => normalizeIndoorLayout(line, venue, 'opening')).toThrow('source level');
  expect(() => normalizeIndoorLayout(openings, venue, 'unit')).toThrow('Unsupported');
});
it('coalesces layout fetches and keeps layer cache keys distinct', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(JSON.stringify(url.includes('mtr_unit_polygon') ? units : openings)),
  );
  const c = new IndoorCatalogue(fetcher, () => 0);
  const [a, b] = await Promise.all([c.layout(venue), c.layout(venue)]);
  expect(a).toEqual(b);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await c.layout(venue);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await expect(c.layout("bad' OR 1=1")).rejects.toThrow();
});
