import citybusIndex from './data/citybus-index.json';
import { Hono } from 'hono';
import {
  nearbyBusQuerySchema,
  nearbyBusStopsSchema,
  busRouteQuerySchema,
  busEtaQuerySchema,
  type BusRouteQuery,
  type BusStop,
  type BusArrival,
  type DataMode,
} from '@hk/contracts';
import {
  CITYBUS_URL,
  normalizeCitybusIndex,
  nearbyBusStops,
  fetchJson,
  normalizeCitybusRoutes,
  normalizeCitybusSequence,
  normalizeCitybusStop,
  joinCitybusStops,
  normalizeCitybusArrivals,
  routeKey,
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
function remember<T>(map: Map<string, T>, key: string, limit: number, create: () => T): T {
  const cached = map.get(key);
  if (cached) return cached;
  if (map.size >= limit) map.delete(map.keys().next().value!);
  const value = create();
  map.set(key, value);
  return value;
}
export function citybusRoutes(fetcher: Fetcher, now: () => number, mode: DataMode) {
  const app = new Hono();
  const common = { provider: 'Citybus', now, mode };
  const index = normalizeCitybusIndex(citybusIndex);
  const indexedStops = Object.fromEntries(index.stops.map((s) => [s.id, s]));
  function indexFeed<T>(data: T) {
    // Discovery is a dated reference snapshot, visibly distinct from live ETA freshness.
    return {
      data,
      provider: 'Citybus discovery index',
      sourceUrl: index.sourceUrl,
      fetchedAt: index.generatedAt,
      sourceUpdatedAt: index.generatedAt,
      status: 'stale' as const,
      mode,
    };
  }
  app.get('/nearby', (c) => {
    const parsed = nearbyBusQuerySchema.safeParse(c.req.query());
    if (!parsed.success) return c.json({ error: 'Choose a map area within Hong Kong.' }, 400);
    return c.json(indexFeed(nearbyBusStopsSchema.parse(nearbyBusStops(indexedStops, parsed.data))));
  });
  app.get('/reported-routes', (c) => {
    const id = c.req.query('stop') ?? '';
    if (!/^\d{6}$/.test(id) || !index.memberships[id])
      return c.json({ error: 'Unknown Citybus stop.' }, 400);
    return c.json(indexFeed(index.memberships[id]));
  });

  // Bound total outbound concurrency and queued work across route requests in this process.
  let active = 0;
  const waiting: Array<() => void> = [];
  async function read(path: string) {
    if (mode === 'fixture') throw new ProviderError('No Citybus recording configured.');
    if (active >= 4) {
      if (waiting.length >= 200)
        throw new ProviderError('Citybus requests are busy. Try again shortly.');
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else active++;
    try {
      return await fetchJson(`${CITYBUS_URL}${path}`, fetcher, {
        maxBytes: 3 * 1024 * 1024,
        timeoutMs: 15_000,
      });
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  }
  const routes = new FeedCache({
    ...common,
    sourceUrl: `${CITYBUS_URL}/route/CTB`,
    policy: cataloguePolicy,
    load: async () => normalizeCitybusRoutes(await read('/route/CTB')),
  });
  const stopCaches = new Map<string, FeedCache<Omit<BusStop, 'seq'>>>();
  const routeCaches = new Map<string, FeedCache<BusStop[]>>();
  const etaCaches = new Map<string, FeedCache<BusArrival[]>>();
  const routeCache = (query: BusRouteQuery) =>
    remember(routeCaches, routeKey(query), 128, () => {
      const path = `/route-stop/CTB/${query.route}/${query.bound === 'O' ? 'outbound' : 'inbound'}`;
      return new FeedCache({
        ...common,
        sourceUrl: `${CITYBUS_URL}${path}`,
        policy: cataloguePolicy,
        load: async () => {
          const sequence = normalizeCitybusSequence(await read(path), query);
          // Resolve in small batches so one route cannot fill the entire request queue.
          const details: Omit<BusStop, 'seq'>[] = [];
          for (let i = 0; i < sequence.data.length; i += 4) {
            const batch = await Promise.all(
              sequence.data.slice(i, i + 4).map(async (s) => {
                const cache = remember(
                  stopCaches,
                  s.stop,
                  2048,
                  () =>
                    new FeedCache({
                      ...common,
                      sourceUrl: `${CITYBUS_URL}/stop/${s.stop}`,
                      policy: cataloguePolicy,
                      load: async () => normalizeCitybusStop(await read(`/stop/${s.stop}`), s.stop),
                    }),
                );
                const feed = await cache.get();
                if (!feed.data || feed.status !== 'fresh')
                  throw new ProviderError('Citybus stop details unavailable.');
                return feed.data;
              }),
            );
            details.push(...batch);
          }
          return joinCitybusStops(sequence, details);
        },
      });
    });
  async function known(query: BusRouteQuery) {
    const feed = await routes.get();
    return feed.data?.some((r) => routeKey(r) === routeKey(query));
  }
  app.get('/routes', async (c) => c.json(await routes.get()));
  app.get('/stops', async (c) => {
    const parsed = busRouteQuerySchema.safeParse(c.req.query());
    if (!parsed.success || !(await known(parsed.data)))
      return c.json({ error: 'Choose a known Citybus route and direction.' }, 400);
    return c.json(await routeCache(parsed.data).get());
  });
  app.get('/arrivals', async (c) => {
    const parsed = busEtaQuerySchema.safeParse(c.req.query());
    if (!parsed.success || !(await known(parsed.data)))
      return c.json({ error: 'Choose a known Citybus route and direction.' }, 400);
    const query = parsed.data;
    const feed = await routeCache(query).get();
    if (!feed.data) return c.json({ error: 'Citybus stops unavailable.' }, 503);
    const stop = feed.data.find((s) => s.seq === query.seq);
    if (!stop) return c.json({ error: 'Stop is not on this Citybus route.' }, 400);
    const path = `/eta/CTB/${stop.id}/${query.route}`;
    const cache = remember(
      etaCaches,
      `${routeKey(query)}/${stop.id}/${stop.seq}`,
      128,
      () =>
        new FeedCache({
          ...common,
          sourceUrl: `${CITYBUS_URL}${path}`,
          policy: etaPolicy,
          load: async () => normalizeCitybusArrivals(await read(path), query, stop),
        }),
    );
    return c.json(await cache.get());
  });
  return app;
}
