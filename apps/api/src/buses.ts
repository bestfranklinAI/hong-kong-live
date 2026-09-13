import { Hono } from 'hono';
import {
  busRouteQuerySchema,
  nearbyBusQuerySchema,
  nearbyBusStopsSchema,
  reportedBusRoutesSchema,
  type ReportedBusRoute,
  busEtaQuerySchema,
  type BusRouteQuery,
  type BusStop,
  type BusArrival,
  type DataMode,
} from '@hk/contracts';
import {
  KMB_URL,
  nearbyBusStops,
  normalizeReportedBusRoutes,
  fetchKmbCatalogue,
  fetchJson,
  normalizeBusRoutes,
  normalizeBusStopCatalogue,
  normalizeBusRouteStops,
  normalizeBusArrivals,
  routeKey,
  routeStopsUrl,
  busEtaUrl,
  ProviderError,
  type Fetcher,
} from '@hk/providers';
import { FeedCache } from './feed-cache';

const cataloguePolicy = {
  freshMs: 3600_000,
  serveMs: 86400_000,
  freshSourceMs: Infinity,
  serveSourceMs: Infinity,
};
const etaPolicy = {
  freshMs: 60_000,
  serveMs: 120_000,
  freshSourceMs: 90_000,
  serveSourceMs: 180_000,
};

export function busRoutes(fetcher: Fetcher, now: () => number, mode: DataMode) {
  const app = new Hono();
  const common = { provider: 'KMB / Long Win', now, mode };
  const readCatalogue = async (url: string) => {
    if (mode === 'fixture')
      throw new ProviderError('No recorded bus fixture is configured.', 60_000);
    return fetchKmbCatalogue(url, fetcher);
  };
  const routes = new FeedCache({
    ...common,
    sourceUrl: `${KMB_URL}/route`,
    policy: cataloguePolicy,
    load: async () => normalizeBusRoutes(await readCatalogue(`${KMB_URL}/route`)),
  });
  const stops = new FeedCache({
    ...common,
    sourceUrl: `${KMB_URL}/stop`,
    policy: cataloguePolicy,
    load: async () => normalizeBusStopCatalogue(await readCatalogue(`${KMB_URL}/stop`)),
  });
  const routeCaches = new Map<string, FeedCache<BusStop[]>>();
  const reportedCaches = new Map<string, FeedCache<ReportedBusRoute[]>>();
  const etaCaches = new Map<string, FeedCache<BusArrival[]>>();
  function routeCache(query: BusRouteQuery) {
    const key = routeKey(query);
    let cache = routeCaches.get(key);
    if (!cache) {
      if (routeCaches.size >= 128) routeCaches.delete(routeCaches.keys().next().value!);
      cache = new FeedCache({
        ...common,
        sourceUrl: routeStopsUrl(query),
        policy: cataloguePolicy,
        load: async () => {
          const catalogue = await stops.get();
          if (!catalogue.data || catalogue.status !== 'fresh')
            throw new ProviderError('Bus stop catalogue unavailable.');
          return normalizeBusRouteStops(
            await readCatalogue(routeStopsUrl(query)),
            query,
            catalogue.data,
          );
        },
      });
      routeCaches.set(key, cache);
    }
    return cache;
  }
  app.get('/nearby', async (c) => {
    const parsed = nearbyBusQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'Choose a map area within Hong Kong.' }, 400);
    const feed = await stops.get();
    return c.json({
      ...feed,
      data: feed.data ? nearbyBusStopsSchema.parse(nearbyBusStops(feed.data, parsed.data)) : null,
    });
  });
  app.get('/reported-routes', async (c) => {
    const id = c.req.query('stop') ?? '';
    if (!/^[A-F0-9]{16}$/.test(id)) return c.json({ error: 'Choose a valid bus stop.' }, 400);
    const catalogue = await stops.get();
    if (!catalogue.data) return c.json({ error: 'Stop catalogue unavailable.' }, 503);
    if (!catalogue.data[id]) return c.json({ error: 'Unknown bus stop.' }, 400);
    let cache = reportedCaches.get(id);
    if (!cache) {
      if (reportedCaches.size >= 128) reportedCaches.delete(reportedCaches.keys().next().value!);
      cache = new FeedCache({
        ...common,
        sourceUrl: `${KMB_URL}/stop-eta/${id}`,
        policy: etaPolicy,
        load: async () => {
          if (mode === 'fixture') throw new ProviderError('No bus recording configured.');
          const result = normalizeReportedBusRoutes(
            await fetchJson(`${KMB_URL}/stop-eta/${id}`, fetcher),
          );
          return { ...result, data: reportedBusRoutesSchema.parse(result.data) };
        },
      });
      reportedCaches.set(id, cache);
    }
    return c.json(await cache.get());
  });

  app.get('/routes', async (c) => c.json(await routes.get()));
  app.get('/stops', async (c) => {
    const parsed = busRouteQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'Choose a valid bus route.' }, 400);
    const catalogue = await routes.get();
    if (!catalogue.data) return c.json({ error: 'Bus routes unavailable.' }, 503);
    if (!catalogue.data.some((r) => routeKey(r) === routeKey(parsed.data)))
      return c.json({ error: 'Unknown bus route variant.' }, 400);
    return c.json(await routeCache(parsed.data).get());
  });
  app.get('/arrivals', async (c) => {
    const parsed = busEtaQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'Choose a valid bus stop.' }, 400);
    const query = parsed.data;
    const catalogue = await routes.get();
    if (!catalogue.data) return c.json({ error: 'Bus routes unavailable.' }, 503);
    if (!catalogue.data.some((r) => routeKey(r) === routeKey(query)))
      return c.json({ error: 'Unknown bus route variant.' }, 400);
    const stopFeed = await routeCache(query).get();
    if (!stopFeed.data) return c.json({ error: 'Bus stops unavailable.' }, 503);
    const stop = stopFeed.data.find((s) => s.seq === query.seq);
    if (!stop) return c.json({ error: 'Stop is not on this route.' }, 400);
    const key = `${routeKey(query)}/${stop.id}/${stop.seq}`;
    let cache = etaCaches.get(key);
    if (!cache) {
      if (etaCaches.size >= 128) etaCaches.delete(etaCaches.keys().next().value!);
      cache = new FeedCache({
        ...common,
        sourceUrl: busEtaUrl(query, stop.id),
        policy: etaPolicy,
        load: async () => {
          if (mode === 'fixture') throw new ProviderError('No recorded bus arrivals configured.');
          return normalizeBusArrivals(
            await fetchJson(busEtaUrl(query, stop.id), fetcher),
            query,
            stop,
          );
        },
      });
      etaCaches.set(key, cache);
    }
    return c.json(await cache.get());
  });
  return app;
}
