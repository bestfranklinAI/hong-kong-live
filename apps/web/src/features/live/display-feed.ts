import type { Feed } from '@hk/contracts';

/** Browser cache age cannot extend the lifetime granted to a live response. */
export function displayFeed<T>(
  feed: Feed<T> | undefined,
  requestFailed: boolean,
  now: number,
  maxAgeMs: number,
  freshMs = maxAgeMs,
): Feed<T> | undefined {
  if (!feed) return undefined;
  const elapsed = now - Date.parse(feed.fetchedAt);
  if (elapsed >= maxAgeMs) return { ...feed, data: null, status: 'unavailable' };
  if ((requestFailed || elapsed >= freshMs) && feed.status === 'fresh')
    return { ...feed, status: 'stale' };
  return feed;
}
