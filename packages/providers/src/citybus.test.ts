import { expect, it } from 'vitest';
import route from '../../../fixtures/providers/citybus/route-1.json';
import stopSource from '../../../fixtures/providers/citybus/stop-001027.json';
import eta from '../../../fixtures/providers/citybus/eta-1.json';
import {
  CITYBUS_URL,
  normalizeCitybusIndex,
  normalizeCitybusRoutes,
  normalizeCitybusStop,
  normalizeCitybusSequence,
  normalizeCitybusArrivals,
} from './citybus';
const query = { route: '1', bound: 'O' as const, service: '1' };
const stop = { ...normalizeCitybusStop(stopSource, '001027').data, seq: 1 };
it('offers directional endpoints without pretending Citybus has KMB service variants', () => {
  const routes = normalizeCitybusRoutes({ ...route, data: [route.data] }).data;
  expect(routes).toHaveLength(2);
  expect(routes[1].origin).toBe(routes[0].destination);
  expect(routes[1].destination).toBe(routes[0].origin);
  expect(() => normalizeCitybusStop(stopSource, '999999')).toThrow();
});
it('keeps empty directions explicit and rejects gaps or mismatched route sequences', () => {
  const source = { ...route, data: [{ co: 'CTB', route: '1', dir: 'O', seq: 1, stop: '001027' }] };
  expect(normalizeCitybusSequence(source, query).data).toHaveLength(1);
  expect(normalizeCitybusSequence({ ...source, data: [] }, query).data).toEqual([]);
  expect(() => normalizeCitybusSequence(source, { ...query, bound: 'I' })).toThrow();
  expect(() =>
    normalizeCitybusSequence({ ...source, data: [{ ...source.data[0], seq: 2 }] }, query),
  ).toThrow();
});
it('filters the shared stop by route, direction and occurrence, preserving notices and source time', () => {
  const result = normalizeCitybusArrivals(eta, query, stop);
  const rows = eta.data.filter((r) => r.dir === 'O' && r.seq === 1);
  expect(result.data).toHaveLength(rows.length);
  expect(result.sourceUpdatedAt).toBe(new Date(rows[0].data_timestamp).toISOString());
  const notice = { ...rows[0], eta: null, rmk_en: 'No service', rmk_tc: '沒有服務' };
  expect(normalizeCitybusArrivals({ ...eta, data: [notice] }, query, stop).data[0]).toMatchObject({
    time: null,
    remark: 'No service',
  });
  expect(normalizeCitybusArrivals(eta, query, { ...stop, seq: 99 }).data).toEqual([]);
  expect(() =>
    normalizeCitybusArrivals({ ...eta, data: [{ ...notice, data_timestamp: 'bad' }] }, query, stop),
  ).toThrow();
});

it('rejects incomplete or duplicate discovery index records', () => {
  const input = {
    generatedAt: '2026-09-13T12:00:00Z',
    sourceRetrievedFrom: '2026-09-13T11:00:00Z',
    sourceUrl: CITYBUS_URL,
    routeCount: 1,
    stops: [{ ...stop }],
    memberships: { '001027': [{ ...query, seq: 1 }] },
  };
  expect(normalizeCitybusIndex(input).stops).toHaveLength(1);
  expect(() => normalizeCitybusIndex({ ...input, memberships: {} })).toThrow();
  expect(() => normalizeCitybusIndex({ ...input, stops: [stop, stop] })).toThrow();
});
