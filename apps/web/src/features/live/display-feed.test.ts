import { describe, expect, it } from 'vitest';
import type { Feed } from '@hk/contracts';
import { displayFeed } from './display-feed';

const now = Date.parse('2026-09-13T06:00:00Z');
const feed: Feed<string[]> = {
  provider: 'MTR',
  sourceUrl: 'https://rt.data.gov.hk/',
  fetchedAt: new Date(now).toISOString(),
  sourceUpdatedAt: new Date(now).toISOString(),
  data: ['departure'],
  status: 'fresh',
  mode: 'live',
};

describe('browser feed age', () => {
  it('does not present cached departures indefinitely when the API becomes unreachable', () => {
    expect(displayFeed(feed, true, now + 91_000, 90_000)).toMatchObject({
      data: null,
      status: 'unavailable',
    });
  });
  it('marks retained data stale after a failed request and preserves source times', () => {
    expect(displayFeed(feed, true, now + 35_000, 90_000)).toMatchObject({
      data: ['departure'],
      status: 'stale',
      sourceUpdatedAt: feed.sourceUpdatedAt,
    });
  });
  it('does not resurrect an unavailable provider response', () => {
    expect(
      displayFeed({ ...feed, data: null, status: 'unavailable' }, false, now, 90_000)?.status,
    ).toBe('unavailable');
  });
  it('marks an old browser response stale while a refresh is still pending', () => {
    expect(displayFeed(feed, false, now + 30_000, 90_000, 30_000)?.status).toBe('stale');
  });
});
