import { expect, it, vi } from 'vitest';
import { createApp } from './app';
import route from '../../../fixtures/providers/citybus/route-1.json';
import stop from '../../../fixtures/providers/citybus/stop-001027.json';
import eta from '../../../fixtures/providers/citybus/eta-1.json';
const sequence = { ...route, data: [{ co: 'CTB', route: '1', dir: 'O', seq: 1, stop: '001027' }] };
it('coalesces Citybus requests, caches stop details and rejects unknown selections', async () => {
  let now = Date.parse(eta.generated_timestamp);
  const fetcher = vi.fn(async (url: string) =>
    Response.json(
      url.endsWith('/route/CTB')
        ? { ...route, data: [route.data] }
        : url.includes('/route-stop/')
          ? sequence
          : url.includes('/stop/')
            ? stop
            : eta,
    ),
  );
  const app = createApp({ fetcher, now: () => now });
  const path = '/api/v1/buses/citybus/arrivals?route=1&bound=O&service=1&seq=1';
  const responses = await Promise.all([app.request(path), app.request(path)]);
  expect((await responses[0].json()).status).toBe('fresh');
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect((await app.request(path.replace('service=1', 'service=2'))).status).toBe(400);
  expect((await app.request(path.replace('seq=1', 'seq=99'))).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(4);
  now += 180_000;
  expect((await (await app.request(path)).json()).data).toBeNull();
});
it('never fetches live Citybus data in fixture mode', async () => {
  const fetcher = vi.fn();
  const app = createApp({ fetcher, mode: 'fixture' });
  const result = await (await app.request('/api/v1/buses/citybus/routes')).json();
  expect(result.status).toBe('unavailable');
  expect(fetcher).not.toHaveBeenCalled();
});

it('uses the dated discovery index without upstream fanout and rejects unknown stops', async () => {
  const fetcher = vi.fn();
  const app = createApp({ fetcher });
  expect((await app.request('/api/v1/buses/citybus/nearby?lng=0&lat=0')).status).toBe(400);
  const nearby = await (
    await app.request('/api/v1/buses/citybus/nearby?lng=114.150422&lat=22.288274')
  ).json();
  expect(nearby.data.length).toBeGreaterThan(0);
  expect(nearby.data.length).toBeLessThanOrEqual(20);
  expect(nearby.provider).toBe('Citybus discovery index');
  expect(nearby.status).toBe('stale');
  const routes = await (
    await app.request(`/api/v1/buses/citybus/reported-routes?stop=${nearby.data[0].id}`)
  ).json();
  expect(routes.data.length).toBeGreaterThan(0);
  expect((await app.request('/api/v1/buses/citybus/reported-routes?stop=999999')).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
