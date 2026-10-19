import { expect, it, vi } from 'vitest';
import {
  parseFehd,
  mergeFehd,
  fetchLandsd,
  matchRestaurantAddress,
  restaurantAddressQuery,
} from './search';
import { coordinateResult } from '@hk/contracts';
const xml = (name: string, date = '2026-09-26', id = '001') =>
  `<DATA><GENERATION_DATE>${date}</GENERATION_DATE><DIST_CODE><CODE ID="12">Wan Chai</CODE></DIST_CODE><LPS><LP><TYPE>RL</TYPE><DIST>12</DIST><LICNO>${id}</LICNO><SS>${name}</SS><ADR>G/F, 14 TAI WONG STREET EAST, HONG KONG</ADR><EXPDATE>2027-01-01</EXPDATE></LP></LPS></DATA>`;
it('joins languages by licence ID and keeps unknown locations null', () => {
  const record = mergeFehd(xml('Bakery &amp; Cafe'), xml('麵包店')).records[0];
  expect(record).toMatchObject({
    id: 'fehd:001',
    name: 'Bakery & Cafe',
    nameZh: '麵包店',
    location: null,
    sourceDate: '2026-09-26',
  });
  expect(() => mergeFehd(xml('A'), xml('甲', '2026-09-25'))).toThrow();
  expect(() => mergeFehd(xml('A'), xml('甲', '2026-09-26', '002'))).toThrow();
  expect(() => parseFehd('<!DOCTYPE DATA [<!ENTITY x "bad">]>' + xml('A'))).toThrow();
  expect(() => parseFehd('<DATA>broken')).toThrow();
});
it('transforms HK80 and deduplicates exact provider results', async () => {
  const raw = {
    nameEN: 'Wan Chai Station',
    nameZH: '灣仔站',
    addressEN: '',
    addressZH: '',
    districtEN: 'Wan Chai',
    districtZH: '灣仔',
    x: 835884.44689252,
    y: 815408.78493788,
  };
  const fetcher = vi.fn(async () => new Response(JSON.stringify([raw, raw])));
  const rows = await fetchLandsd('Wan Chai', fetcher);
  expect(rows).toHaveLength(1);
  expect(rows[0].location!.lng).toBeCloseTo(114.1732, 3);
  expect(rows[0].location!.lat).toBeCloseTo(22.2775, 3);
  expect(fetcher.mock.calls).toHaveLength(1);
});
it('rejects district-only and ambiguous address matches', () => {
  const restaurant = mergeFehd(xml('A'), xml('甲')).records[0];
  const candidate = {
    ...coordinateResult({ lat: 22.3, lng: 114.17 }),
    address: '14 TAI WONG STREET EAST',
  };
  expect(matchRestaurantAddress(restaurant, [{ ...candidate, address: '' }])).toBeUndefined();
  expect(matchRestaurantAddress(restaurant, [candidate])).toBe(candidate);
  expect(
    matchRestaurantAddress(restaurant, [
      candidate,
      { ...candidate, location: { lat: 22.31, lng: 114.17 } },
    ]),
  ).toBeUndefined();
  expect(restaurantAddressQuery(restaurant.address)).toBe('14 TAI WONG STREET EAST, HONG KONG');
});

it('matches a numbered street inside a building range and a multi-street address', () => {
  const restaurant = {
    ...mergeFehd(xml('A'), xml('甲')).records[0],
    address: 'G/F, 4 MONG LUNG STREET, SHAU KEI WAN, HONG KONG',
  };
  const building = {
    ...coordinateResult({ lat: 22.28, lng: 114.22 }),
    address: '12-18 KAM WA STREET|4-6 MONG LUNG STREET',
  };
  expect(matchRestaurantAddress(restaurant, [building])).toBe(building);
  expect(
    matchRestaurantAddress({ ...restaurant, district: 'Eastern 東區' }, [
      { ...building, district: 'Eastern District' },
    ])?.location,
  ).toEqual(building.location);
  for (const address of [
    '5 MONG LUNG STREET',
    '4 MONG LUNG ROAD',
    '4 MONG LUNG STREET EAST',
    '4A MONG LUNG STREET',
  ])
    expect(matchRestaurantAddress({ ...restaurant, address }, [building])).toBeUndefined();
  expect(
    matchRestaurantAddress(restaurant, [
      building,
      { ...building, location: { lat: 22.3, lng: 114.2 } },
    ]),
  ).toBeUndefined();
  expect(
    matchRestaurantAddress({ ...restaurant, district: 'Eastern 東區' }, [
      { ...building, district: 'Wan Chai' },
    ]),
  ).toBeUndefined();
});

it('normalizes building abbreviations and strips shop/floor prefixes for reuse', () => {
  expect(restaurantAddressQuery('SHOP 2, 1/F, TAI ON BLDG, 57-87 SHAU KEI WAN RD, HONG KONG')).toBe(
    'TAI ON BUILDING, 57-87 SHAU KEI WAN ROAD, HONG KONG',
  );
});
