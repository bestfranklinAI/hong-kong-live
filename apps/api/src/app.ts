import { searchRoutes } from './search/routes';
import type { SearchRepository } from './search/repository';
import { LandsdSearch } from './search/landsd';
import { citybusRoutes } from './citybus';
import { busRoutes } from './buses';
import { sharedWeatherReport } from './weather-report';
import { fetchWeatherReport, normalizeRegionalWeather } from '@hk/providers';
import type { RegionalObservation } from '@hk/contracts';
import type { TrafficCamera } from '@hk/contracts';
import { CAMERA_SOURCE_URL, fetchCameras } from '@hk/providers';
import type { Arrival, DataMode, WeatherSummary, Rainfall } from '@hk/contracts';
import {
  fetchRainfall,
  RAINFALL_SOURCE_URL,
  ProviderError,
  fetchArrivals,
  mtrSourceUrl,
  normalizeArrivals,
  normalizeWeather,
  stationQuerySchema,
  WEATHER_SOURCE_URL,
  type Fetcher,
} from '@hk/providers';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import recordedWeather from '../../../fixtures/providers/hko-2026-09-13.json';
import recordedArrivals from '../../../fixtures/providers/mtr-isl-adm-2026-09-13.json';
import { ARRIVALS_POLICY, FeedCache, WEATHER_POLICY } from './feed-cache';

export interface AppOptions {
  facilities?: import('@hk/providers').FacilityCatalogue;
  searchRepository?: SearchRepository;
  landsd?: LandsdSearch;
  fetcher?: Fetcher;
  now?: () => number;
  mode?: DataMode;
}

/** Dependencies are explicit so fixtures and tests never patch global fetch. */
export function createApp(options: AppOptions = {}) {
  const app = new Hono();
  const mode = options.mode ?? 'live';
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  app.route(
    '/api/v1/search',
    searchRoutes(
      options.searchRepository,
      options.landsd ?? new LandsdSearch(fetcher, now),
      mode,
      now,
      fetcher,
      options.facilities,
    ),
  );
  const report = sharedWeatherReport(
    mode === 'fixture' ? async () => recordedWeather : () => fetchWeatherReport(fetcher),
    now,
  );
  const regionalWeather = new FeedCache<RegionalObservation[]>({
    provider: 'Hong Kong Observatory',
    sourceUrl: WEATHER_SOURCE_URL,
    now,
    mode,
    policy: {
      freshMs: 60_000,
      serveMs: 15 * 60_000,
      freshSourceMs: 60 * 60_000,
      serveSourceMs: 90 * 60_000,
    },
    load: async () => normalizeRegionalWeather(await report()),
  });
  const weather = new FeedCache<WeatherSummary>({
    provider: 'Hong Kong Observatory',
    sourceUrl: WEATHER_SOURCE_URL,
    policy: WEATHER_POLICY,
    now,
    mode,
    load: async () => normalizeWeather(await report()),
  });
  const rainfall = new FeedCache<Rainfall>({
    provider: 'Hong Kong Observatory',
    sourceUrl: RAINFALL_SOURCE_URL,
    now,
    mode,
    policy: {
      freshMs: 12 * 60_000,
      serveMs: 2 * 60 * 60_000,
      freshSourceMs: 24 * 60_000,
      serveSourceMs: 2 * 60 * 60_000,
    },
    load: async () => {
      if (mode === 'fixture')
        throw new ProviderError('No recorded rainfall fixture is configured.', 60_000);
      try {
        const result = await fetchRainfall(fetcher);
        if (Date.parse(result.sourceUpdatedAt) > now() + 120_000) {
          throw new ProviderError('Rainfall source clock is in the future.', 60_000);
        }
        return result;
      } catch (error) {
        throw new ProviderError(
          error instanceof ProviderError ? error.message : 'Rainfall source could not be reached.',
          60_000,
        );
      }
    },
  });
  const cameras = new FeedCache<TrafficCamera[]>({
    provider: 'Transport Department',
    sourceUrl: CAMERA_SOURCE_URL,
    now,
    mode,
    policy: {
      freshMs: 60 * 60_000,
      serveMs: 24 * 60 * 60_000,
      freshSourceMs: Infinity,
      serveSourceMs: Infinity,
    },
    load: async () => {
      if (mode === 'fixture')
        throw new ProviderError('No recorded camera catalogue is configured.', 60_000);
      try {
        return await fetchCameras(fetcher);
      } catch {
        throw new ProviderError('Camera catalogue unavailable. Please try again later.', 60_000);
      }
    },
  });
  const stations = new Map<string, FeedCache<Arrival[]>>();

  app.use('/api/*', async (c, next) => {
    // Query caching is explicit; intermediaries must not silently prolong ETA freshness.
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-HK-Data-Mode', mode);
    await next();
  });

  app.use('/api/v1/weather/rainfall/*', compress());

  app.route('/api/v1/buses/kmb', busRoutes(fetcher, now, mode));
  app.route('/api/v1/buses/citybus', citybusRoutes(fetcher, now, mode));

  app.get('/api/v1/cameras', async (c) => c.json(await cameras.get()));

  app.get('/api/v1/health', (c) => c.json({ status: 'ok', mode }));

  // One compact, atomic publication avoids mixing frames from different source revisions.
  app.get('/api/v1/weather/rainfall/manifest', async (c) => c.json(await rainfall.get()));

  app.get('/api/v1/weather/regional', async (c) => c.json(await regionalWeather.get()));

  app.get('/api/v1/weather/current', async (c) => c.json(await weather.get()));

  app.get('/api/v1/arrivals', async (c) => {
    const parsed = stationQuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json(
        {
          error: 'Choose a valid station on one of the supported MTR lines.',
        },
        400,
      );
    }
    const query = parsed.data;
    const key = `${query.line}-${query.station}`;
    if (mode === 'fixture' && key !== 'ISL-ADM') {
      return c.json({
        data: null,
        provider: 'MTR',
        sourceUrl: mtrSourceUrl(query),
        fetchedAt: new Date(now()).toISOString(),
        sourceUpdatedAt: null,
        status: 'unavailable',
        mode,
        error: 'Only ISL Admiralty has a recorded fixture. Choose Admiralty to inspect it.',
      });
    }
    let cache = stations.get(key);
    if (!cache) {
      cache = new FeedCache<Arrival[]>({
        provider: 'MTR',
        sourceUrl: mtrSourceUrl(query),
        policy: ARRIVALS_POLICY,
        now,
        mode,
        load:
          mode === 'fixture'
            ? async () => normalizeArrivals(recordedArrivals, query)
            : () => fetchArrivals(query, fetcher),
      });
      stations.set(key, cache);
    }
    return c.json(await cache.get());
  });

  app.notFound((c) => c.json({ error: 'Endpoint not found.' }, 404));
  app.onError((_error, c) => c.json({ error: 'The request could not be completed.' }, 500));
  return app;
}

// No Node globals in this entry point: deploy adapters may use this fetch handler.
export default createApp();
