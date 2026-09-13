import { expect, it } from 'vitest';
import { mtrLines, type Feed, type Arrival } from '@hk/contracts';
import { incomingSegment, railSegments, railwayRoutes } from './network';
import {
  approaches,
  positionOnTrack,
  distances,
  track,
  approachDistance,
  STATION_DWELL_MS,
} from './motion';
const now = Date.parse('2026-09-13T12:00:00Z');
const arrival: Arrival = {
  id: 'approach',
  direction: 'UP',
  destinationCode: 'CHW',
  destination: 'Chai Wan',
  platform: '1',
  remark: 'Estimated train time',
  time: new Date(now + 30000).toISOString(),
};
const feed: Feed<Arrival[]> = {
  data: [arrival],
  provider: 'MTR',
  sourceUrl: 'https://rt.data.gov.hk',
  mode: 'live',
  status: 'fresh',
  fetchedAt: new Date(now).toISOString(),
  sourceUpdatedAt: new Date(now).toISOString(),
};
const input = { selection: { line: 'ISL', station: 'ADM' }, enabled: true, feed };
it('uses the correct preceding station in both directions and excludes remote arrivals', () => {
  const east = approaches(input, now)[0];
  expect(east.segment?.from).toBe('CEN');
  expect(east.segment?.to).toBe('ADM');
  expect(east.from).toBe(0);
  const west = approaches(
    {
      ...input,
      feed: { ...feed, data: [{ ...arrival, direction: 'DOWN', destinationCode: 'KET' }] },
    },
    now,
  )[0];
  expect(west.segment?.to).toBe('WAC');
  expect(west.segment?.from).toBe('ADM');
  expect(west.to).toBe(0);
  expect(
    approaches(
      {
        ...input,
        feed: { ...feed, data: [{ ...arrival, time: new Date(now + 600000).toISOString() }] },
      },
      now,
    ),
  ).toEqual([]);
});
it('hides stale, fixture, delayed, past and terminal-origin estimates', () => {
  expect(approaches(input, now + 90000)).toEqual([]);
  for (const patch of [
    { status: 'stale' as const },
    { mode: 'fixture' as const },
    { sourceUpdatedAt: null },
    { data: [{ ...arrival, remark: 'Service delay reported by MTR' }] },
    { data: [{ ...arrival, time: new Date(now - STATION_DWELL_MS).toISOString() }] },
  ])
    expect(approaches({ ...input, feed: { ...feed, ...patch } }, now)).toEqual([]);
  expect(approaches({ ...input, selection: { line: 'ISL', station: 'KET' } }, now)).toEqual([]);
  expect(approaches({ ...input, enabled: false }, now)).toEqual([]);
});
it('keeps route interpolation bounded and includes all 17 stations in order', () => {
  expect(Object.keys(track.stations)).toHaveLength(17);
  expect(positionOnTrack(-1)).toEqual(track.coordinates[0]);
  expect(positionOnTrack(distances.at(-1)! + 1)).toEqual(track.coordinates.at(-1));
  expect(distances.every((v, i) => i === 0 || v > distances[i - 1])).toBe(true);
});

it('holds at the station for eight seconds, then removes the illustration', () => {
  const at = Date.parse(arrival.time);
  const row = approaches(input, at)[0];
  expect(approachDistance(row, at - 1000)).toBeLessThan(row.to);
  expect(approachDistance(row, at)).toBe(row.to);
  expect(approachDistance(approaches(input, at + 7999)[0], at + 7999)).toBe(row.to);
  expect(approaches(input, at + 8000)).toEqual([]);
});
it('shows independent station approaches across the line and isolates stale feeds', () => {
  const stationFeeds = ['ADM', 'WAC', 'CAB', 'NOP'].map((station) => ({
    station,
    feed: { ...feed, data: [{ ...arrival, id: station }] },
  }));
  expect(approaches({ ...input, stationFeeds }, now)).toHaveLength(4);
  stationFeeds[1].feed.status = 'stale';
  expect(approaches({ ...input, stationFeeds }, now).map((row) => row.station)).toEqual([
    'ADM',
    'CAB',
    'NOP',
  ]);
  expect(approaches({ ...input, stationFeeds, enabled: false }, now)).toEqual([]);
});

it('covers every supported line and station with bounded real track segments', () => {
  expect(Object.keys(railSegments).sort()).toEqual(mtrLines.map((line) => line.code).sort());
  for (const line of mtrLines) {
    const covered = new Set(
      railwayRoutes[line.code].flatMap((route) => Object.keys(route.stations)),
    );
    expect([...covered].sort()).toEqual([...line.stations].sort());
    for (const segment of railSegments[line.code]) {
      expect(segment.coordinates.length).toBeGreaterThan(1);
      expect(segment.distances.at(-1)).toBeGreaterThan(0);
      expect(positionOnTrack(-1, segment)).toEqual(segment.coordinates[0]);
      expect(positionOnTrack(Infinity, segment)).toEqual(segment.coordinates.at(-1));
      // Reject accidental geographic jumps in the source preparation.
      expect(
        segment.distances.every((value, i) => i === 0 || value - segment.distances[i - 1] < 3000),
      ).toBe(true);
    }
  }
});
it('uses branch topology and hides ambiguous incoming branches', () => {
  expect(incomingSegment('TKL', 'TKO', 'LHP', false)?.segment.from).toBe('TIK');
  expect(incomingSegment('TKL', 'HAH', 'POA', false)?.segment.from).toBe('TKO');
  expect(incomingSegment('TKL', 'TKO', 'NOP', false)).toBeUndefined();
  expect(incomingSegment('EAL', 'SHS', 'ADM', false)).toBeUndefined();
  expect(incomingSegment('EAL', 'UNI', 'LOW', false)?.segment.from).toBe('FOT');
  expect(incomingSegment('EAL', 'UNI', 'LMC', true)?.segment.from).toBe('RAC');
  expect(incomingSegment('TWL', 'ADM', 'CHW', false)).toBeUndefined();
});
it('animates fresh services on every line including terminal shuttles', () => {
  for (const line of mtrLines) {
    const route = railwayRoutes[line.code][0];
    const order = Object.keys(route.stations);
    const terminalOnly = order.length === 2;
    const station = order[terminalOnly ? 0 : 1];
    const at = terminalOnly ? now : now + 30_000;
    const rows = approaches(
      {
        enabled: true,
        selection: { line: line.code, station },
        feed: {
          ...feed,
          data: [{ ...arrival, time: new Date(at).toISOString(), destinationCode: order.at(-1)! }],
        },
      },
      now,
    );
    expect(rows, line.code).toHaveLength(1);
    expect(rows[0].line).toBe(line.code);
    expect(rows[0].departure).toBe(terminalOnly);
  }
});
it('holds a departing shuttle before its time and then moves along the outgoing track', () => {
  const shuttle = {
    ...input,
    selection: { line: 'DRL', station: 'SUN' },
    feed: {
      ...feed,
      data: [{ ...arrival, destinationCode: 'DIS', time: new Date(now).toISOString() }],
    },
  };
  const row = approaches(shuttle, now - 4000)[0];
  expect(row.departure).toBe(true);
  expect(approachDistance(row, now - 4000)).toBe(row.from);
  expect(approachDistance(row, now + 10000)).toBeGreaterThan(row.from);
  expect(approaches(shuttle, now - 8001)).toEqual([]);
});
