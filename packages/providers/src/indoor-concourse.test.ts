import { expect, it, vi } from 'vitest';
import { IndoorCatalogue } from './indoor';
import type { Fetcher } from './http';
import type { IndoorPoint, IndoorFloor } from '@hk/contracts';
it('resolves an explicitly assumed concourse to a real internal source point, never a platform or invented centre', async () => {
  const catalogue = new IndoorCatalogue(vi.fn<Fetcher>(), () => 0);
  const station = { id: 'station', name: 'Kowloon Station', nameZh: '九龍鐵路站' };
  vi.spyOn(catalogue, 'stations').mockResolvedValue({ stations: [station], fetchedAt: '' });
  vi.spyOn(catalogue, 'floors').mockResolvedValue({
    floors: [{ id: 'concourse', name: 'Concourse Level', nameZh: '大堂' } as IndoorFloor],
    fetchedAt: '',
    sourceUpdatedAt: null,
  });
  const base = {
    lat: 22.3,
    lng: 114.16,
    z: 13.5,
    venueId: station.id,
    levelId: 'concourse',
    levelName: 'Concourse Level',
  };
  vi.spyOn(catalogue, 'points').mockResolvedValue({
    points: [
      { ...base, id: 'exit', category: 'entry' },
      { ...base, id: 'lift', category: 'elevator', lng: 114.1601 },
      { ...base, id: 'platform', category: 'platform', levelId: 'other' },
    ] as IndoorPoint[],
    fetchedAt: '',
    sourceUpdatedAt: null,
  });
  const result = await catalogue.resolve({
    lat: 22.3,
    lng: 114.16,
    name: 'Kowloon',
    assumedConcourse: true,
  });
  expect(result.indoor?.pointId).toBe('lift');
  expect(result.lng).toBe(114.1601);
  expect(result.z).toBe(13.5);
  expect(result.assumedConcourse).toBe(true);
});
