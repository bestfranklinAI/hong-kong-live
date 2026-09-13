import type { Arrival, Feed, StationSelection } from '@hk/contracts';
import track from './island-line.json';
import { incomingSegment, railSegments, type RailSegment } from './network';
export { track };
export interface TrainMotionInput {
  selection: StationSelection;
  feed?: Feed<Arrival[]>;
  stationFeeds?: { station: string; feed?: Feed<Arrival[]> }[];
  enabled: boolean;
}
export interface TrainApproach {
  arrival: Arrival;
  station: string;
  line: string;
  segment?: RailSegment;
  departure?: boolean;
  from: number;
  to: number;
  startsAt: number;
  endsAt: number;
}
export const STATION_DWELL_MS = 8000;
export const distances = track.coordinates.map(() => 0);
for (let i = 1; i < distances.length; i++) {
  const a = track.coordinates[i - 1],
    b = track.coordinates[i];
  distances[i] =
    distances[i - 1] +
    Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 111195;
}
/** Deliberately simple timing model, not telemetry or a persistent vehicle identity. */
export function approaches(input: TrainMotionInput | null, now: number): TrainApproach[] {
  if (input?.stationFeeds)
    return input.stationFeeds.flatMap(({ station, feed }) =>
      approaches(
        { selection: { line: input.selection.line, station }, enabled: input.enabled, feed },
        now,
      ),
    );
  const feed = input?.feed;
  if (
    !input?.enabled ||
    !railSegments[input.selection.line] ||
    feed?.status !== 'fresh' ||
    feed.mode !== 'live' ||
    feed.data?.some((arrival) => /delay/i.test(arrival.remark)) ||
    !feed.sourceUpdatedAt ||
    now - Date.parse(feed.sourceUpdatedAt) >= 90000 ||
    now - Date.parse(feed.sourceUpdatedAt) < -120000 ||
    now - Date.parse(feed.fetchedAt) >= 90000
  )
    return [];
  const result: TrainApproach[] = [];
  for (const direction of ['UP', 'DOWN'] as const) {
    const row = feed.data
      ?.filter(
        (a) =>
          a.direction === direction &&
          (() => {
            if (!a.destinationCode) return false;
            const path = incomingSegment(
              input.selection.line,
              input.selection.station,
              a.destinationCode,
              /Via Racecourse/i.test(a.remark) ||
                input.selection.station === 'RAC' ||
                a.destinationCode === 'RAC',
            );
            const extra = path?.departure
              ? (path.segment.distances.at(-1)! / (40000 / 3600)) * 1000 + 20000
              : 0;
            return Date.parse(a.time) + extra + STATION_DWELL_MS > now;
          })(),
      )
      .sort((a, b) => a.time.localeCompare(b.time))[0];
    if (!row || /delay/i.test(row.remark) || !row.destinationCode) continue;
    const match = incomingSegment(
      input.selection.line,
      input.selection.station,
      row.destinationCode,
      /Via Racecourse/i.test(row.remark) ||
        input.selection.station === 'RAC' ||
        row.destinationCode === 'RAC',
    );
    if (!match) continue;
    const { segment, step, departure } = match;
    const length = segment.distances.at(-1)!;
    const from = step > 0 ? 0 : length,
      to = step > 0 ? length : 0;
    // 40 km/h average motion + 20 seconds for station approach: a disclosed visual assumption.
    const duration = (Math.abs(to - from) / (40000 / 3600)) * 1000 + 20000;
    const time = Date.parse(row.time);
    const startsAt = departure ? time : time - duration;
    const endsAt = departure ? time + duration : time;
    if (now < startsAt - (departure ? STATION_DWELL_MS : 0) || now >= endsAt + STATION_DWELL_MS)
      continue;
    result.push({
      arrival: row,
      station: input.selection.station,
      line: input.selection.line,
      segment,
      departure,
      from,
      to,
      startsAt,
      endsAt,
    });
  }
  return result;
}
export function positionOnTrack(distance: number, segment?: RailSegment): [number, number] {
  const coordinates = segment?.coordinates ?? track.coordinates;
  const points = segment?.distances ?? distances;
  let i = 1;
  while (i < points.length - 1 && points[i] < distance) i++;
  const ratio = Math.max(
    0,
    Math.min(1, (distance - points[i - 1]) / (points[i] - points[i - 1] || 1)),
  );
  const a = coordinates[i - 1],
    b = coordinates[i];
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}

/** Clamp at the platform during the illustrative dwell, never overshoot the track segment. */
export function approachDistance(row: TrainApproach, now: number) {
  const progress = Math.max(0, Math.min(1, (now - row.startsAt) / (row.endsAt - row.startsAt)));
  return row.from + (row.to - row.from) * progress;
}
