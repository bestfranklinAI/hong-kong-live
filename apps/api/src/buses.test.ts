import { expect, it, vi } from 'vitest';
import { createApp } from './app';
import fixture from '../../../fixtures/providers/kmb-1a-2026-09-13.json';

it('validates catalogue membership, coalesces requests and expires old ETA observations', async () => {
  let now = Date.parse('2026-09-13T12:01:12Z');
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      url.endsWith('/route')
        ? fixture.routes
        : url.endsWith('/stop')
          ? fixture.stops
          : url.includes('/route-stop/')
            ? fixture.routeStops
            : fixture.arrivals,
    ),
  );
  const app = createApp({ fetcher, now: () => now });
  const path = '/api/v1/buses/kmb/arrivals?route=1A&bound=O&service=1&seq=1';
  const responses = await Promise.all([app.request(path), app.request(path)]);
  expect(fetcher).toHaveBeenCalledTimes(4);
  const result = await responses[0].json();
  expect(result.status).toBe('fresh');
  expect(result.data).toHaveLength(3);
  const bad = await app.request(path.replace('route=1A', 'route=INVALID'));
  expect(bad.status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect((await app.request(path.replace('seq=1', 'seq=199'))).status).toBe(400);
  now += 180_000;
  expect((await (await app.request(path)).json()).data).toBeNull();
});
it('fixture mode never falls through to live bus sources', async () => {
  const fetcher = vi.fn();
  const app = createApp({ fetcher, mode: 'fixture' });
  const result = await (await app.request('/api/v1/buses/kmb/routes')).json();
  expect(result.mode).toBe('fixture');
  expect(result.status).toBe('unavailable');
  expect(fetcher).not.toHaveBeenCalled();
});

it('searches nearby using the shared catalogue and validates stop membership before route lookup', async () => {
  const fetcher = vi.fn(async (url: string) =>
    Response.json(url.endsWith('/stop') ? fixture.stops : fixture.arrivals),
  );
  const app = createApp({ fetcher, now: () => Date.parse('2026-09-13T12:01:12Z') });
  expect((await app.request('/api/v1/buses/kmb/nearby?lng=0&lat=0')).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  const stop = fixture.stops.data[0];
  const url = `/api/v1/buses/kmb/nearby?lng=${stop.long}&lat=${stop.lat}`;
  const result = await (await app.request(url)).json();
  expect(result.data[0].id).toBe(stop.stop);
  expect(result.data[0].distance).toBe(0);
  await app.request(url);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    (await app.request('/api/v1/buses/kmb/reported-routes?stop=0000000000000000')).status,
  ).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const routes = await (
    await app.request(`/api/v1/buses/kmb/reported-routes?stop=${stop.stop}`)
  ).json();
  expect(routes.data).toHaveLength(2);
});
