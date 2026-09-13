import { mtrLines, mtrStations, stationSelectionSchema, type Arrival } from '@hk/contracts';
import { z } from 'zod';
import { fetchJson, ProviderError, type Fetcher } from './http';
import { parseSourceTime } from './time';
import type { SourceResult } from './types';

export const MTR_SOURCE_URL = 'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php';

/** A finite shared catalogue bounds cache keys and rejects unsupported line/station pairs. */
export const SUPPORTED_STATIONS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  mtrLines.map((line) => [line.code, line.stations]),
);
export const stationQuerySchema = stationSelectionSchema;

export type StationQuery = z.infer<typeof stationQuerySchema>;

const trainSchema = z.object({
  seq: z.union([z.string(), z.number()]).transform(String),
  dest: z.string(),
  plat: z.union([z.string(), z.number()]).transform(String),
  time: z.string(),
  valid: z.string(),
  source: z.string().optional(),
  timetype: z.enum(['A', 'D']).optional(),
  route: z.string().optional(),
});
const stationSchema = z.object({
  curr_time: z.string(),
  UP: z.array(trainSchema).optional(),
  DOWN: z.array(trainSchema).optional(),
});
const responseSchema = z.object({
  status: z.number().int(),
  message: z.string().optional(),
  curr_time: z.string().optional(),
  isdelay: z.string().optional(),
  data: z.record(z.string(), stationSchema).optional(),
});

export function mtrSourceUrl(query: StationQuery): string {
  return `${MTR_SOURCE_URL}?${new URLSearchParams({ line: query.line, sta: query.station, lang: 'EN' })}`;
}

export function normalizeArrivals(input: unknown, query: StationQuery): SourceResult<Arrival[]> {
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) throw new ProviderError('MTR source format has changed.');
  const response = parsed.data;
  // status=0 includes service/data errors. It is not evidence of an empty timetable.
  if (response.status !== 1)
    throw new ProviderError('MTR departure information is currently unavailable.');
  const station = response.data?.[`${query.line}-${query.station}`];
  if (!station) throw new ProviderError('MTR did not return the requested station.');
  const sourceUpdatedAt = parseSourceTime(station.curr_time);
  const arrivals: Arrival[] = [];
  for (const direction of ['UP', 'DOWN'] as const) {
    for (const train of station[direction] ?? []) {
      if (train.valid !== 'Y') continue;
      const time = parseSourceTime(train.time);
      if (!time) throw new ProviderError('MTR returned an invalid departure time.');
      arrivals.push({
        destinationCode: train.dest,
        direction,
        id: `${query.line}-${query.station}-${direction}-${train.seq}-${time}`,
        destination: mtrStations[train.dest]?.name ?? train.dest,
        platform: train.plat,
        time,
        remark: [
          train.timetype === 'A'
            ? 'Estimated arrival'
            : train.timetype === 'D'
              ? 'Estimated departure'
              : 'Estimated train time',
          train.route === 'RAC' ? 'Via Racecourse' : '',
          response.isdelay === 'Y' ? 'Service delay reported by MTR' : '',
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }
  return { data: arrivals.sort((a, b) => a.time.localeCompare(b.time)), sourceUpdatedAt };
}

export async function fetchArrivals(
  query: StationQuery,
  fetcher: Fetcher,
): Promise<SourceResult<Arrival[]>> {
  return normalizeArrivals(await fetchJson(mtrSourceUrl(query), fetcher), query);
}
