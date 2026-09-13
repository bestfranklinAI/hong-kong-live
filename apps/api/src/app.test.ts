import { syntheticRainfall } from '../../../fixtures/providers/synthetic-rainfall';
import { arrivalsFeedSchema, weatherFeedSchema } from '@hk/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app';

describe('API integration', () => {
  it('provides explicitly labelled, dated fixtures without upstream calls', async () => {
    const fetcher = vi.fn();
    const app = createApp({
      mode: 'fixture',
      fetcher,
      now: () => Date.parse('2026-09-13T06:16:54Z'),
    });
    const weather = await app.request('/api/v1/weather/current');
    expect(weatherFeedSchema.parse(await weather.json())).toMatchObject({
      mode: 'fixture',
      status: 'fresh',
    });
    const arrivals = await app.request('/api/v1/arrivals?line=ISL&station=ADM');
    expect(arrivalsFeedSchema.parse(await arrivals.json())).toMatchObject({
      mode: 'fixture',
      status: 'fresh',
    });
    expect(arrivals.headers.get('Cache-Control')).toBe('no-store');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates input before contacting a source', async () => {
    const fetcher = vi.fn();
    const app = createApp({ fetcher });
    expect((await app.request('/api/v1/arrivals?line=ISL&station=TST')).status).toBe(400);
    expect((await app.request('/api/v1/arrivals')).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps a live outage unavailable instead of falling back to a fixture', async () => {
    const app = createApp({ fetcher: vi.fn().mockRejectedValue(new Error('offline')) });
    const response = await app.request('/api/v1/weather/current');
    expect(await response.json()).toMatchObject({
      mode: 'live',
      status: 'unavailable',
      data: null,
    });
  });

  it('does not relabel the Admiralty fixture as a different station', async () => {
    const app = createApp({ mode: 'fixture' });
    const response = await app.request('/api/v1/arrivals?line=TWL&station=TST');
    expect(await response.json()).toMatchObject({
      mode: 'fixture',
      status: 'unavailable',
      data: null,
    });
  });
});

describe('rainfall API publication', () => {
  it('shares concurrent fetches, accepts corrections and retains last-good data on failures', async () => {
    let now = Date.parse('2026-09-13T04:01:00Z');
    const csv = syntheticRainfall();
    const fetcher = vi.fn().mockImplementation(async () => new Response(csv));
    const app = createApp({ fetcher, now: () => now });
    const get = async () => (await app.request('/api/v1/weather/rainfall/manifest')).json();
    const [first, second] = await Promise.all([get(), get()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.data.revision).toBe(second.data.revision);
    now += 12 * 60_000;
    fetcher.mockImplementation(async () => new Response(csv.replace(',12.34', ',15.00')));
    const corrected = await get();
    expect(corrected.data.revision).not.toBe(first.data.revision);
    now += 12 * 60_000;
    fetcher.mockImplementation(async () => new Response('truncated'));
    const stale = await get();
    expect(stale.status).toBe('stale');
    expect(stale.data.revision).toBe(corrected.data.revision);
    now = Date.parse('2026-09-13T06:00:00Z');
    expect((await get()).data).toBeNull();
  });
  it('never fetches live rainfall in fixture mode', async () => {
    const fetcher = vi.fn();
    const app = createApp({ mode: 'fixture', fetcher });
    const response = await app.request('/api/v1/weather/rainfall/manifest');
    expect(await response.json()).toMatchObject({
      mode: 'fixture',
      status: 'unavailable',
      data: null,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('keeps camera catalogue outages and fixture mode explicit', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
  const app = createApp({ fetcher });
  const [first, second] = await Promise.all([
    app.request('/api/v1/cameras'),
    app.request('/api/v1/cameras'),
  ]);
  expect(await first.json()).toMatchObject({ data: null, status: 'unavailable', mode: 'live' });
  expect(await second.json()).toMatchObject({ data: null });
  expect(fetcher).toHaveBeenCalledTimes(1);
  const fixture = createApp({ mode: 'fixture', fetcher });
  expect(await (await fixture.request('/api/v1/cameras')).json()).toMatchObject({
    data: null,
    mode: 'fixture',
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('serves regional and reference observations from one upstream report', async () => {
  const { default: report } = await import('../../../fixtures/providers/hko-2026-09-13.json');
  const fetcher = vi.fn(async () => new Response(JSON.stringify(report)));
  const app = createApp({ fetcher, now: () => Date.parse('2026-09-13T06:16:00Z') });
  const [reference, regional] = await Promise.all([
    app.request('/api/v1/weather/current'),
    app.request('/api/v1/weather/regional'),
  ]);
  expect((await reference.json()).data.station).toBe('Hong Kong Observatory');
  const feed = await regional.json();
  expect(feed.status).toBe('fresh');
  expect(feed.data).toHaveLength(27);
  expect(
    feed.data.find((item: { station: string }) => item.station === 'Sha Tin').humidity,
  ).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
