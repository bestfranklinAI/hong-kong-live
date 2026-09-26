import { expect, it } from 'vitest';
import type { Arrival, Feed } from '@hk/contracts';
import { TrainJourneys } from './journeys';
const now = Date.parse('2026-09-26T05:00:00Z');
const arrival: Arrival = {
  id: 'a',
  direction: 'UP',
  destinationCode: 'CHW',
  destination: 'Chai Wan',
  platform: '1',
  remark: '',
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
it('keeps identity and position continuous across revised IDs and arrival times', () => {
  const engine = new TrainJourneys();
  const first = engine.update(input, now)[0];
  const position = first.distance;
  const revised = {
    ...input,
    feed: {
      ...feed,
      data: [{ ...arrival, id: 'revised', time: new Date(now + 45000).toISOString() }],
    },
  };
  const next = engine.update(revised, now + 100)[0];
  expect(next.id).toBe(first.id);
  expect(next.distance).toBeGreaterThanOrEqual(position);
  expect(next.distance - position).toBeLessThan(1);
});
it('holds a disappeared arrival at its station and hands off without a duplicate', () => {
  const engine = new TrainJourneys();
  const atStation = {
    ...input,
    feed: { ...feed, data: [{ ...arrival, time: new Date(now).toISOString() }] },
  };
  const id = engine.update(atStation, now)[0].id;
  const nextFeed = {
    ...feed,
    data: [{ ...arrival, id: 'next', time: new Date(now + 60000).toISOString() }],
  };
  const network = {
    ...input,
    stationFeeds: [
      { station: 'ADM', feed: { ...feed, data: [] } },
      { station: 'WAC', feed: nextFeed },
    ],
  };
  for (let time = now + 100; time <= now + 7000; time += 100) {
    const train = engine.update(network, time).find((j) => j.id === id)!;
    expect(train.distance).toBe(train.row.to);
  }
  for (let time = now + 7100; time <= now + 10000; time += 100) engine.update(network, time);
  const rows = engine.update(network, now + 10100);
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe(id);
  expect(rows[0].row.station).toBe('WAC');
  expect(rows[0].distance).toBeGreaterThan(rows[0].row.from);
});
it('retires missing estimates and clears disabled animations', () => {
  const engine = new TrainJourneys();
  engine.update(input, now);
  const empty = { ...input, feed: { ...feed, data: [] } };
  for (let time = now + 100; time <= now + 32000; time += 100) engine.update(empty, time);
  expect(engine.update(empty, now + 32100)).toEqual([]);
  engine.update(input, now);
  expect(engine.update({ ...input, enabled: false }, now + 100)).toEqual([]);
});
