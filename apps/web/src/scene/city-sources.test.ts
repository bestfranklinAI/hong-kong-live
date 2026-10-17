import { expect, it } from 'vitest';
import { resolveCitySources, scopeCitySource } from './city-sources';
import { Resource } from 'cesium';

it('derives only the documented LandsD sibling while keeping access parameters in configuration', () => {
  const original =
    'https://data.map.gov.hk/api/3d-data/3dtiles/f2/tileset.json?key=test-public-key';
  const sources = resolveCitySources(original);
  expect(sources.photo).toBe(original);
  expect(sources.buildings).toBe(
    'https://data.map.gov.hk/api/3d-data/3dsd/WGS84/building/tileset.json?key=test-public-key',
  );
});
it('does not invent a sibling for custom servers or replace an explicit buildings source', () => {
  expect(resolveCitySources('https://example.test/tileset.json').buildings).toBeUndefined();
  expect(resolveCitySources('https://data.map.gov.hk/custom.json').buildings).toBeUndefined();
  expect(
    resolveCitySources('https://example.test/photo.json', '/local/buildings.json').buildings,
  ).toBe('/local/buildings.json');
});
it('identifies a directly configured buildings source without labelling it a photo mesh', () => {
  const url = 'https://data.map.gov.hk/api/3d-data/3dsd/WGS84/building/tileset.json';
  expect(resolveCitySources(url)).toEqual({ buildings: url });
});

it('keeps repeat caching stable while separating origin-specific CORS responses and child resources', () => {
  const source =
    'https://data.map.gov.hk/api/3d-data/3dsd/WGS84/building/tileset.json?key=test-key';
  const dev = scopeCitySource(source, 'http://127.0.0.1:5173');
  const preview = scopeCitySource(source, 'http://127.0.0.1:4173');
  expect(preview).not.toBe(dev);
  expect(scopeCitySource(source, 'http://127.0.0.1:4173')).toBe(preview);
  const root = new URL(preview);
  const child = new URL(new Resource(preview).getDerivedResource({ url: 'child.json' }).url);
  expect(child.searchParams.get('_hk_origin')).toBe(root.searchParams.get('_hk_origin'));
  expect(child.searchParams.get('key')).toBe('test-key');
  expect(preview).not.toContain('127.0.0.1');
  expect(scopeCitySource('/tilesets/local.json', 'http://127.0.0.1:4173')).toBe(
    'http://127.0.0.1:4173/tilesets/local.json',
  );
});
