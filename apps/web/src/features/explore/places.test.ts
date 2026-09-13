import { describe, expect, it } from 'vitest';
import { getPlace, places, searchPlaces } from './places';

describe('curated place search', () => {
  it('returns the discovery catalog for a blank query without changing its order', () => {
    expect(searchPlaces(' \n\t ', 'all')).toEqual(places);
  });

  it.each([
    ['  TAI\tKWUN  ', 'tai-kwun'],
    ['táï kwún', 'tai-kwun'],
    ['大館', 'tai-kwun'],
    ['元創方', 'pmq'],
    ['Ｍ＋', 'm-plus'],
    ['m plus', 'm-plus'],
    ['MTR金鐘', 'admiralty-station'],
    ['尖沙咀MTR', 'tsim-sha-tsui-station'],
    ['tst mtr', 'tsim-sha-tsui-station'],
  ])('finds %s through normalized names and aliases', (query, id) => {
    expect(searchPlaces(query, 'all').map((place) => place.id)).toEqual([id]);
  });

  it('combines category and all query tokens rather than broadening the results', () => {
    expect(searchPlaces('central', 'station').map((place) => place.id)).toEqual([
      'admiralty-station',
      'central-station',
    ]);
    expect(searchPlaces('central harbour', 'waterfront').map((place) => place.id)).toEqual([
      'central-waterfront',
    ]);
    expect(searchPlaces('central harbour', 'station')).toEqual([]);
  });

  it('returns no result for an unknown place or an unmatched extra token', () => {
    expect(searchPlaces('not-a-real-place', 'all')).toEqual([]);
    expect(searchPlaces('tai kwun mars', 'all')).toEqual([]);
  });

  it('resolves stable links without substituting a default for unknown IDs', () => {
    expect(getPlace('central-waterfront')?.nameZh).toBe('中環海濱');
    expect(getPlace('missing')).toBeUndefined();
  });
});

describe('curated place integrity', () => {
  it('has unique shareable IDs, valid HK coordinates and traceable HTTPS sources', () => {
    expect(new Set(places.map((place) => place.id)).size).toBe(places.length);
    for (const place of places) {
      expect(place.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(place.lng).toBeGreaterThan(113.8);
      expect(place.lng).toBeLessThan(114.5);
      expect(place.lat).toBeGreaterThan(22.1);
      expect(place.lat).toBeLessThan(22.6);
      expect(new URL(place.source.url).protocol).toBe('https:');
      expect(place.nameZh.length).toBeGreaterThan(0);
      expect(place.category === 'station').toBe(Boolean(place.station));
    }
  });
});

it('includes official discovery points across all 18 districts with bilingual regional search', () => {
  expect(places).toHaveLength(47);
  expect(new Set(places.map((place) => place.district)).size).toBe(18);
  expect(searchPlaces('沙田', 'park').map((place) => place.name)).toContain('Sha Tin Park');
  expect(searchPlaces('Tung Chung', 'park').map((place) => place.name)).toContain(
    'Tung Chung North Park',
  );
  expect(searchPlaces('屯門', 'park').map((place) => place.name)).toContain('Tuen Mun Park');
  expect(searchPlaces('Sai Kung', 'waterfront').map((place) => place.name)).toContain(
    'Sai Kung Waterfront Park',
  );
});
