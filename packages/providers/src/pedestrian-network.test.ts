import { expect, it, vi } from 'vitest';
import { networkRequestSchema } from '@hk/contracts';
import { PedestrianNetworkProvider } from './pedestrian-network';

const request = {
  paths: [
    [
      [114.16, 22.28],
      [114.162, 22.281],
    ],
  ],
  category: 'connections' as const,
};
const edge = {
  attributes: {
    OBJECTID: 1,
    PedestrianRouteID: 10,
    FeatureType: 10,
    WeatherProof: 1,
    Enabled: 2,
    FloorID: 90,
    AccessTimeID: 80,
    LastAmendmentDate: 1660003200000,
  },
  geometry: {
    hasZ: true,
    paths: [
      [
        [114.16, 22.28, -8],
        [114.16, 22.28, 5],
      ],
    ],
  },
};
it('queries a fixed buffered route, preserves vertical edges and coded false, and shares cached reads', async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    expect(url).toMatch(
      /^https:\/\/portal.csdi.gov.hk\/server\/rest\/services\/common\/landsd_rcd_1637222018065_52265\/MapServer\/0\/query$/,
    );
    expect(options?.method).toBe('POST');
    const query = new URLSearchParams(options?.body as string);
    expect(query.get('distance')).toBe('50');
    expect(query.get('where')).toBe('1=1');
    expect(JSON.parse(query.get('geometry')!).paths).toEqual(request.paths);
    return Response.json({ hasZ: true, spatialReference: { wkid: 4326 }, features: [edge] });
  });
  const provider = new PedestrianNetworkProvider(fetcher, () => 0);
  const [first, second] = await Promise.all([
    provider.nearRoute(networkRequestSchema.parse(request)),
    provider.nearRoute(networkRequestSchema.parse(request)),
  ]);
  expect(first).toEqual(second);
  expect(first.segments[0]).toMatchObject({
    enabled: false,
    kind: 'Lift',
    cover: 'covered',
    floorId: '90',
    accessTimeId: '80',
    amendedAt: '2022-08-09T00:00:00.000Z',
  });
  expect(first.segments[0].paths[0].map((p) => p[2])).toEqual([-8, 5]);
  expect(first.fetchedAt).toBe('1970-01-01T00:00:00.000Z');
  await provider.nearRoute(networkRequestSchema.parse(request));
  await provider.nearRoute(networkRequestSchema.parse({ ...request, category: 'cover' }));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('pages in stable order, caps work, reports partial results and rejects source errors', async () => {
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    const offset = Number(new URLSearchParams(options?.body as string).get('resultOffset'));
    return Response.json({
      spatialReference: { wkid: 4326 },
      exceededTransferLimit: true,
      features: [
        {
          ...edge,
          attributes: { ...edge.attributes, OBJECTID: offset, PedestrianRouteID: offset },
        },
      ],
    });
  });
  const result = await new PedestrianNetworkProvider(fetcher).nearRoute(
    networkRequestSchema.parse(request),
  );
  expect(result.partial).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(result.segments).toHaveLength(3);
  const failed = new PedestrianNetworkProvider(async () => Response.json({ error: { code: 400 } }));
  await expect(failed.nearRoute(networkRequestSchema.parse(request))).rejects.toThrow(
    'unavailable',
  );
});
it('rejects invalid or oversized network routes and arbitrary query options', () => {
  expect(
    networkRequestSchema.safeParse({
      ...request,
      paths: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
    }).success,
  ).toBe(false);
  expect(networkRequestSchema.safeParse({ ...request, url: 'https://example.com' }).success).toBe(
    false,
  );
  expect(
    networkRequestSchema.safeParse({
      ...request,
      paths: [Array.from({ length: 6001 }, () => [114.16, 22.28])],
    }).success,
  ).toBe(false);
});
it('keeps window boundaries connected without joining disjoint paths and deduplicates overlapping records', async () => {
  const windows: number[][][][] = [];
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    const query = new URLSearchParams(init?.body as string);
    expect((init?.body as string).length).toBeLessThan(7000);
    windows.push(JSON.parse(query.get('geometry')!).paths);
    return Response.json({ spatialReference: { wkid: 4326 }, features: [edge] });
  });
  const path = Array.from(
    { length: 170 },
    (_, i) => [114.16 + i / 100000, 22.28] as [number, number],
  );
  const separate: [number, number][] = [
    [114.18, 22.28],
    [114.181, 22.28],
  ];
  const result = await new PedestrianNetworkProvider(fetcher).nearRoute({
    paths: [path, separate],
    category: 'connections',
  });
  expect(windows).toHaveLength(4);
  expect(windows[0][0].at(-1)).toEqual(windows[1][0][0]);
  expect(windows[2][0].at(-1)).toEqual(path.at(-1));
  expect(windows[3]).toEqual([separate]);
  expect(result.segments).toHaveLength(1);
  expect(result.partial).toBe(false);
});
