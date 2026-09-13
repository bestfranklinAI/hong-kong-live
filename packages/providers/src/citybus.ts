import { z } from 'zod';
import {
  busRoutesSchema,
  busStopSchema,
  busStopsSchema,
  busArrivalsSchema,
  type BusRouteQuery,
  type BusStop,
} from '@hk/contracts';
import { ProviderError } from './http';
import { parseSourceTime } from './time';

export const CITYBUS_URL = 'https://rt.data.gov.hk/v2/transport/citybus';
const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({ generated_timestamp: z.string(), data: schema });
const timestamp = (value: string) => {
  const time = parseSourceTime(value);
  if (!time) throw new ProviderError('Citybus source time is invalid.');
  return time;
};
const rawRoute = z.object({
  co: z.literal('CTB'),
  route: z.string(),
  orig_en: z.string(),
  orig_tc: z.string(),
  dest_en: z.string(),
  dest_tc: z.string(),
});
export function normalizeCitybusRoutes(input: unknown) {
  const source = envelope(z.array(rawRoute).min(1).max(2500)).parse(input);
  if (new Set(source.data.map((r) => r.route)).size !== source.data.length)
    throw new ProviderError('Duplicate Citybus route.');
  // The catalogue has no direction field. These are direction choices; an empty stop list means that direction is not provided.
  const data = busRoutesSchema.parse(
    source.data.flatMap((r) =>
      (['O', 'I'] as const).map((bound) => ({
        route: r.route,
        bound,
        service: '1',
        origin: bound === 'O' ? r.orig_en : r.dest_en,
        originZh: bound === 'O' ? r.orig_tc : r.dest_tc,
        destination: bound === 'O' ? r.dest_en : r.orig_en,
        destinationZh: bound === 'O' ? r.dest_tc : r.orig_tc,
      })),
    ),
  );
  return { data, sourceUpdatedAt: timestamp(source.generated_timestamp) };
}
export function normalizeCitybusSequence(input: unknown, query: BusRouteQuery) {
  const source = envelope(
    z
      .array(
        z.object({
          co: z.literal('CTB'),
          route: z.string(),
          dir: z.enum(['O', 'I']),
          seq: z.number().int().positive(),
          stop: z.string().regex(/^\d{6}$/),
        }),
      )
      .max(200),
  ).parse(input);
  const data = source.data.sort((a, b) => a.seq - b.seq);
  if (data.some((r, i) => r.route !== query.route || r.dir !== query.bound || r.seq !== i + 1))
    throw new ProviderError('Citybus stop sequence does not match the route.');
  return { data, sourceUpdatedAt: timestamp(source.generated_timestamp) };
}
export function normalizeCitybusStop(input: unknown, id: string) {
  const source = envelope(
    z.object({
      stop: z.string(),
      name_en: z.string(),
      name_tc: z.string(),
      lat: z.coerce.number(),
      long: z.coerce.number(),
    }),
  ).parse(input);
  const s = source.data;
  if (s.stop !== id) throw new ProviderError('Citybus returned a different stop.');
  return {
    data: busStopSchema
      .omit({ seq: true })
      .parse({ id, name: s.name_en, nameZh: s.name_tc, lng: s.long, lat: s.lat }),
    sourceUpdatedAt: timestamp(source.generated_timestamp),
  };
}
export function joinCitybusStops(
  sequence: ReturnType<typeof normalizeCitybusSequence>,
  stops: Omit<BusStop, 'seq'>[],
) {
  return {
    data: busStopsSchema.parse(sequence.data.map((s, i) => ({ ...stops[i], seq: s.seq }))),
    sourceUpdatedAt: sequence.sourceUpdatedAt,
  };
}
export function normalizeCitybusArrivals(input: unknown, query: BusRouteQuery, stop: BusStop) {
  const source = envelope(
    z
      .array(
        z.object({
          co: z.literal('CTB'),
          route: z.string(),
          dir: z.enum(['O', 'I']),
          seq: z.number().int(),
          stop: z.string(),
          eta_seq: z.number().int(),
          eta: z.string().nullable(),
          dest_en: z.string(),
          rmk_en: z.string(),
          rmk_tc: z.string(),
          data_timestamp: z.string(),
        }),
      )
      .max(100),
  ).parse(input);
  const rows = source.data.filter(
    (r) =>
      r.route === query.route && r.dir === query.bound && r.seq === stop.seq && r.stop === stop.id,
  );
  const data = busArrivalsSchema.parse(
    rows.map((r) => ({
      id: `${r.seq}-${r.eta_seq}`,
      time: r.eta ? timestamp(r.eta) : null,
      destination: r.dest_en,
      remark: r.rmk_en,
      remarkZh: r.rmk_tc,
    })),
  );
  return {
    data,
    sourceUpdatedAt: rows.length
      ? rows.map((r) => timestamp(r.data_timestamp)).sort()[0]!
      : timestamp(source.generated_timestamp),
  };
}

/** Validated, dated discovery snapshot; never used as an arrival estimate. */
export function normalizeCitybusIndex(input: unknown) {
  const source = z
    .object({
      generatedAt: z.iso.datetime(),
      sourceRetrievedFrom: z.string(),
      sourceUrl: z.literal(CITYBUS_URL),
      routeCount: z.number().int().positive(),
      stops: z
        .array(busStopSchema.omit({ seq: true }))
        .min(1)
        .max(10000),
      memberships: z.record(
        z.string().regex(/^\d{6}$/),
        z
          .array(
            z.object({
              route: z.string().regex(/^[A-Z0-9]{1,8}$/),
              bound: z.enum(['O', 'I']),
              service: z.literal('1'),
              seq: z.number().int().min(1).max(200),
            }),
          )
          .min(1)
          .max(300),
      ),
    })
    .parse(input);
  if (
    new Set(source.stops.map((s) => s.id)).size !== source.stops.length ||
    source.stops.some((s) => !/^\d{6}$/.test(s.id) || !source.memberships[s.id]) ||
    Object.keys(source.memberships).length !== source.stops.length
  )
    throw new ProviderError('Incomplete Citybus discovery index.');
  return source;
}
