import { expect, it } from 'vitest';
import fixture from '../../../fixtures/providers/kmb-1a-2026-09-13.json';
import {
  normalizeBusRoutes,
  nearbyBusStops,
  normalizeReportedBusRoutes,
  normalizeBusStopCatalogue,
  normalizeBusRouteStops,
  normalizeBusArrivals,
} from './kmb';
const query = { route: '1A', bound: 'O' as const, service: '1' };
it('joins official route sequence to stop coordinates and preserves repeated physical stops', () => {
  expect(normalizeBusRoutes(fixture.routes).data.some((r) => r.route === '1A')).toBe(true);
  const catalogue = normalizeBusStopCatalogue(fixture.stops).data;
  const stops = normalizeBusRouteStops(fixture.routeStops, query, catalogue).data;
  expect(stops).toHaveLength(35);
  expect(stops[0].id).toBe('A3ADFCDF8487ADB9');
  const repeated = structuredClone(fixture.routeStops);
  repeated.data[1].stop = repeated.data[0].stop;
  expect(normalizeBusRouteStops(repeated, query, catalogue).data[1].seq).toBe(2);
  expect(() =>
    normalizeBusRouteStops(fixture.routeStops, { ...query, bound: 'I' }, catalogue),
  ).toThrow();
  expect(() => normalizeBusRouteStops(fixture.routeStops, query, {})).toThrow();
});
it('filters direction, service and occurrence while keeping scheduled-bus remarks', () => {
  const result = normalizeBusArrivals(fixture.arrivals, query, { seq: 1 });
  expect(result.data).toHaveLength(3);
  expect(result.data[0].remark).toBe('Scheduled Bus');
  expect(result.sourceUpdatedAt).toBe('2026-09-13T12:00:22.000Z');
  expect(normalizeBusArrivals(fixture.arrivals, query, { seq: 34 }).data).toEqual([]);
  expect(
    normalizeBusArrivals(fixture.arrivals, { ...query, service: '2' }, { seq: 1 }).data,
  ).toEqual([]);
});
it('retains null ETA notices without inventing a time and rejects invalid source clocks', () => {
  const source = structuredClone(fixture.arrivals) as {
    generated_timestamp: string;
    data: Array<Omit<(typeof fixture.arrivals.data)[number], 'eta'> & { eta: string | null }>;
  };
  source.data[0].eta = null;
  source.data[0].rmk_en = 'No scheduled departures';
  expect(normalizeBusArrivals(source, query, { seq: 1 }).data[0].time).toBeNull();
  source.data[0].data_timestamp = 'unknown';
  expect(() => normalizeBusArrivals(source, query, { seq: 1 })).toThrow();
});

it('orders nearby stops by distance, excludes distant stops and limits dense results', () => {
  const catalogue = Object.fromEntries(
    Array.from({ length: 25 }, (_, i) => [
      String(i),
      { id: String(i), name: 'test', nameZh: '測試', lng: 114.17, lat: 22.3 + i * 0.0001 },
    ]),
  );
  catalogue.far = { id: 'far', name: 'far', nameZh: '遠', lng: 114.3, lat: 22.5 };
  const result = nearbyBusStops(catalogue, { lng: 114.17, lat: 22.3 });
  expect(result).toHaveLength(20);
  expect(result[0].distance).toBe(0);
  expect(result[1].distance).toBe(11);
  expect(result.some((s) => s.id === 'far')).toBe(false);
  expect(nearbyBusStops(catalogue, { lng: 113.9, lat: 22.2 })).toEqual([]);
});
it('deduplicates reported routes while retaining direction and stop occurrence', () => {
  const result = normalizeReportedBusRoutes(fixture.arrivals);
  expect(result.data).toEqual([
    { route: '1A', bound: 'O', service: '1', seq: 1 },
    { route: '1A', bound: 'I', service: '1', seq: 34 },
  ]);
});
