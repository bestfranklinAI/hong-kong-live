import { z } from 'zod';
import {
  busRoutesSchema,
  busStopsSchema,
  busArrivalsSchema,
  type BusRouteQuery,
  type BusStop,
} from '@hk/contracts';
import { fetchJson, ProviderError, type Fetcher } from './http';
import { parseSourceTime } from './time';

export const KMB_URL = 'https://data.etabus.gov.hk/v1/transport/kmb';
const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ generated_timestamp: z.string(), data: schema });
const positive = z.coerce.number().int().positive();
const rawRoute = z.object({
  route: z.string(),
  bound: z.enum(['O', 'I']),
  service_type: z.string(),
  orig_en: z.string(),
  orig_tc: z.string(),
  dest_en: z.string(),
  dest_tc: z.string(),
});
const rawStop = z.object({
  stop: z.string(),
  name_en: z.string(),
  name_tc: z.string(),
  lat: z.coerce.number(),
  long: z.coerce.number(),
});
const rawSequence = z.object({
  route: z.string(),
  bound: z.enum(['O', 'I']),
  service_type: z.string(),
  seq: positive,
  stop: z.string(),
});
export const routeKey = (query: BusRouteQuery) => `${query.route}/${query.bound}/${query.service}`;
export const routeStopsUrl = (query: BusRouteQuery) =>
  `${KMB_URL}/route-stop/${query.route}/${query.bound === 'O' ? 'outbound' : 'inbound'}/${query.service}`;
export const busEtaUrl = (query: BusRouteQuery, stop: string) =>
  `${KMB_URL}/eta/${stop}/${query.route}/${query.service}`;
export const fetchKmbCatalogue = (url: string, fetcher: Fetcher) =>
  fetchJson(url, fetcher, { maxBytes: 3 * 1024 * 1024, timeoutMs: 15_000 });

export function normalizeBusRoutes(input: unknown) {
  const source = envelope(z.array(rawRoute).max(5000)).parse(input);
  const data = busRoutesSchema.parse(
    source.data.map((r) => ({
      route: r.route,
      bound: r.bound,
      service: r.service_type,
      origin: r.orig_en,
      originZh: r.orig_tc,
      destination: r.dest_en,
      destinationZh: r.dest_tc,
    })),
  );
  if (!data.length || new Set(data.map(routeKey)).size !== data.length)
    throw new ProviderError('Invalid KMB route catalogue.');
  return { data, sourceUpdatedAt: parseSourceTime(source.generated_timestamp) };
}
export function normalizeBusStopCatalogue(input: unknown) {
  const source = envelope(z.array(rawStop).max(15000)).parse(input);
  const data = Object.fromEntries(
    source.data.map((s) => [
      s.stop,
      { id: s.stop, name: s.name_en, nameZh: s.name_tc, lng: s.long, lat: s.lat },
    ]),
  );
  if (!source.data.length || Object.keys(data).length !== source.data.length)
    throw new ProviderError('Invalid KMB stop catalogue.');
  return { data, sourceUpdatedAt: parseSourceTime(source.generated_timestamp) };
}
export function normalizeBusRouteStops(
  input: unknown,
  query: BusRouteQuery,
  catalogue: ReturnType<typeof normalizeBusStopCatalogue>['data'],
) {
  const source = envelope(z.array(rawSequence).max(200)).parse(input);
  if (
    source.data.some(
      (r) => r.route !== query.route || r.bound !== query.bound || r.service_type !== query.service,
    )
  )
    throw new ProviderError('KMB returned a different route.');
  const data = busStopsSchema
    .parse(source.data.map((r) => ({ ...catalogue[r.stop], seq: r.seq })))
    .sort((a, b) => a.seq - b.seq);
  if (!data.length || data.some((s, i) => s.seq !== i + 1))
    throw new ProviderError('KMB stop sequence is incomplete.');
  return { data, sourceUpdatedAt: parseSourceTime(source.generated_timestamp) };
}
const rawEta = z.object({
  route: z.string(),
  dir: z.enum(['O', 'I']),
  service_type: positive,
  seq: positive,
  eta_seq: positive,
  eta: z.string().nullable(),
  dest_en: z.string(),
  rmk_en: z.string(),
  rmk_tc: z.string(),
  data_timestamp: z.string(),
});
export function normalizeBusArrivals(
  input: unknown,
  query: BusRouteQuery,
  stop: Pick<BusStop, 'seq'>,
) {
  const source = envelope(z.array(rawEta).max(100)).parse(input);
  // A physical stop can occur in both directions or multiple times on a circular route.
  const rows = source.data.filter(
    (r) =>
      r.route === query.route &&
      r.dir === query.bound &&
      String(r.service_type) === query.service &&
      r.seq === stop.seq,
  );
  const times = rows.map((r) => parseSourceTime(r.data_timestamp));
  if (times.some((t) => !t)) throw new ProviderError('KMB observation time is invalid.');
  const data = busArrivalsSchema.parse(
    rows.map((r) => {
      const time = r.eta ? parseSourceTime(r.eta) : null;
      if (r.eta && !time) throw new ProviderError('KMB arrival time is invalid.');
      return {
        id: `${r.seq}-${r.eta_seq}`,
        time,
        destination: r.dest_en,
        remark: r.rmk_en,
        remarkZh: r.rmk_tc,
      };
    }),
  );
  return {
    data,
    sourceUpdatedAt: times.length
      ? (times as string[]).sort()[0]
      : parseSourceTime(source.generated_timestamp),
  };
}

/** Straight-line surface distance; this is not a walkable route or entrance distance. */
export function nearbyBusStops(
  catalogue: ReturnType<typeof normalizeBusStopCatalogue>['data'],
  centre: { lng: number; lat: number },
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  return Object.values(catalogue)
    .map((stop) => {
      const a =
        Math.sin(rad(stop.lat - centre.lat) / 2) ** 2 +
        Math.cos(rad(centre.lat)) *
          Math.cos(rad(stop.lat)) *
          Math.sin(rad(stop.lng - centre.lng) / 2) ** 2;
      return { ...stop, distance: 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) };
    })
    .filter((s) => s.distance <= 800)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))
    .slice(0, 20)
    .map((s) => ({ ...s, distance: Math.round(s.distance) }));
}

export function normalizeReportedBusRoutes(input: unknown) {
  const source = envelope(z.array(rawEta).max(1000)).parse(input);
  const data = [
    ...new Map(
      source.data.map((r) => {
        const route = { route: r.route, bound: r.dir, service: String(r.service_type), seq: r.seq };
        return [`${routeKey(route)}/${r.seq}`, route] as const;
      }),
    ).values(),
  ];
  const times = source.data.map((r) => parseSourceTime(r.data_timestamp));
  if (times.some((t) => !t)) throw new ProviderError('Bus source observation time is invalid.');
  return {
    data,
    sourceUpdatedAt: times.length
      ? (times as string[]).sort()[0]
      : parseSourceTime(source.generated_timestamp),
  };
}
