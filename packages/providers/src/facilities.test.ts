import { expect, it, vi } from 'vitest';
import {
  FACILITY_SOURCES,
  FacilityCatalogue,
  fetchFacilities,
  normalizeFacility,
} from './facilities';
const time = Date.parse('2026-09-26T00:00:00Z'),
  fetchedAt = new Date(time).toISOString();
const feature = (id = 1) => ({
  geometry: { type: 'Point', coordinates: [114.18, 22.3] },
  properties: {
    OBJECTID: id,
    NameEN: `Library ${id}`,
    NameTC: '圖書館',
    DistrictEN: 'District',
    OpeningHoursEN: 'N.A.',
    WebsiteEN: 'javascript:alert(1)',
    LASTUPDATE: time - 86400000,
  },
});
it('preserves official geometry and separates source dates from download times', () => {
  const row = normalizeFacility(FACILITY_SOURCES[1], feature(), fetchedAt);
  expect(row.location).toEqual({ lng: 114.18, lat: 22.3 });
  expect(row.sourceDate).toBe('2026-09-25T00:00:00.000Z');
  expect(row.facility).toMatchObject({ category: 'library', hours: '', fetchedAt });
  expect(row.facility?.website).toBeUndefined();
  expect(() =>
    normalizeFacility(
      FACILITY_SOURCES[1],
      { ...feature(), geometry: { type: 'Point', coordinates: [0, 0] } },
      fetchedAt,
    ),
  ).toThrow();
});
it('normalizes refill instructions without inventing source timestamps or working status', () => {
  const row = normalizeFacility(
    FACILITY_SOURCES[2],
    {
      ...feature(),
      properties: {
        OBJECTID: 1,
        Name_of_Building_or_Facility_EN: 'Park',
        Name_of_Building_or_Facility_TC: '公園',
        Location_EN: 'Near office',
        Service_Hours_From: '0:00',
        Service_Hours_To: '24:00',
        Service_Hours_Exception_EN: 'Closed during maintenance',
        Water_Temperature_EN: 'Ambient',
      },
    },
    fetchedAt,
  );
  expect(row.name).toBe('Park');
  expect(row.sourceDate).toBeNull();
  expect(row.facility?.locationNote).toBe('Near office');
  expect(row.facility?.hours).toContain('Closed during maintenance');
});
it('uses AFCD stable facility identifiers and distinguishes same-venue facilities', () => {
  const row = normalizeFacility(
    FACILITY_SOURCES[3],
    {
      ...feature(),
      properties: {
        FAC_ID: 'PSL/WS/001',
        FACILITY_NAME_EN: 'Filling station',
        LOCATION_EN: 'Office',
        SERVICE_HOUR: '24 hours',
      },
    },
    fetchedAt,
  );
  expect(row.id).toContain('PSL/WS/001');
  expect(row.source).toBe('AFCD');
  expect(normalizeFacility(FACILITY_SOURCES[2], feature(1), fetchedAt).id).not.toBe(
    normalizeFacility(FACILITY_SOURCES[2], feature(2), fetchedAt).id,
  );
});
it('paginates complete snapshots and rejects duplicate or partial pages', async () => {
  const fetcher = vi.fn(async (url: string) => {
    const query = new URL(url).searchParams;
    if (query.has('returnCountOnly')) return Response.json({ count: 101 });
    const offset = Number(query.get('resultOffset'));
    return Response.json({
      type: 'FeatureCollection',
      features: Array.from({ length: offset === 0 ? 100 : 1 }, (_, i) => feature(offset + i)),
    });
  });
  expect((await fetchFacilities(FACILITY_SOURCES[1], fetcher, () => time)).records).toHaveLength(
    101,
  );
  expect(fetcher).toHaveBeenCalledTimes(3);
  const duplicate = async (url: string) =>
    Response.json(
      url.includes('returnCountOnly')
        ? { count: 2 }
        : { type: 'FeatureCollection', features: [feature(), feature()] },
    );
  await expect(fetchFacilities(FACILITY_SOURCES[1], duplicate)).rejects.toThrow('duplicate');
  const partial = async (url: string) =>
    Response.json(
      url.includes('returnCountOnly')
        ? { count: 2 }
        : { type: 'FeatureCollection', features: [feature()] },
    );
  await expect(fetchFacilities(FACILITY_SOURCES[1], partial)).rejects.toThrow('Incomplete');
});
it('coalesces refreshes and retains last-good data after upstream failure', async () => {
  const fetcher = vi.fn(async () => {
    throw new Error('Offline');
  });
  const record = normalizeFacility(FACILITY_SOURCES[1], feature(), fetchedAt);
  const catalogue = new FacilityCatalogue(
    fetcher,
    [{ dataset: FACILITY_SOURCES[1].id, fetchedAt, records: [record] }],
    () => time + 3 * 86400000,
  );
  await Promise.all([catalogue.refresh(), catalogue.refresh()]);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(catalogue.data().records).toEqual([record]);
  expect(catalogue.data().sources[1].status).toBe('stale');
  expect(catalogue.data().sources[0].status).toBe('unavailable');
  catalogue.dispose();
  await catalogue.refresh();
  expect(fetcher).toHaveBeenCalledTimes(4);
});
