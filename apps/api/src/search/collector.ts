import { createHash } from 'node:crypto';
import {
  FEHD_URLS,
  fetchCatalogueXml,
  mergeFehd,
  matchRestaurantAddress,
  restaurantAddressQuery,
  fetchRestaurantLocations,
  type Fetcher,
} from '@hk/providers';
import type { RestaurantStore } from './store';
import type { LandsdSearch } from './landsd';

export function expectedCatalogueDate(now: number) {
  // FEHD publishes at 09:00 HKT. Allow 30 minutes before considering today's snapshot due.
  return new Date(now + 8 * 3600000 - 9.5 * 3600000).toISOString().slice(0, 10);
}
export async function importRestaurants(store: RestaurantStore, fetcher: Fetcher, now = Date.now) {
  const [en, tc] = await Promise.all([
    fetchCatalogueXml(FEHD_URLS.en, fetcher),
    fetchCatalogueXml(FEHD_URLS.tc, fetcher),
  ]);
  const fetchedAt = new Date(now()).toISOString();
  const data = mergeFehd(en, tc);
  if (
    data.records.length < 1000 ||
    data.date > new Date(now() + 8 * 3600000).toISOString().slice(0, 10)
  )
    throw new Error('Unexpected FEHD snapshot; publication withheld.');
  store.publish(
    data.records,
    data.date,
    createHash('sha256').update(en).update(tc).digest('hex'),
    fetchedAt,
    now(),
  );
  return data.records.length;
}
export function startRestaurantCollector(
  store: RestaurantStore,
  landsd: LandsdSearch,
  fetcher: Fetcher,
) {
  const lifetime = new AbortController();
  const collectorFetch: Fetcher = (url, init) =>
    fetcher(url, {
      ...init,
      signal: AbortSignal.any([lifetime.signal, ...(init?.signal ? [init.signal] : [])]),
    });
  let stopped = false,
    running = false,
    lastImport = 0,
    lastPointImport = 0,
    lastEnrichment = 0;
  const run = async () => {
    if (stopped || running) return;
    const now = Date.now(),
      status = store.status(now),
      due = expectedCatalogueDate(now);
    const refreshDue = (status.sourceDate ?? '') < due;
    running = true;
    try {
      if (refreshDue && now - lastImport >= 3600000) {
        lastImport = now;
        try {
          const count = await importRestaurants(store, collectorFetch);
          console.info(
            `Restaurant catalogue ready: ${count} licences, source ${store.status(Date.now()).sourceDate}.`,
          );
        } catch {
          console.warn(
            'Restaurant refresh unavailable; retaining the last catalogue and retrying in one hour.',
          );
        }
      }
      if (
        !stopped &&
        now - store.pointSnapshotTime() >= 24 * 3600000 &&
        now - lastPointImport >= 3600000
      ) {
        lastPointImport = now;
        try {
          const snapshot = await fetchRestaurantLocations(collectorFetch);
          if (!stopped) {
            const matched = store.applyOfficialLocations(snapshot.records, snapshot.fetchedAt);
            console.info(
              `Restaurant map ready: ${matched} licence/address joins from official FEHD reference points.`,
            );
          }
        } catch {
          if (!stopped)
            console.warn(
              'Restaurant point refresh unavailable; retaining known locations and retrying in one hour.',
            );
        }
      }
      if (!stopped && now - lastEnrichment >= 5 * 60000) {
        lastEnrichment = now;
        await enrichRestaurantLocations(store, landsd, Date.now, () => stopped);
      }
    } finally {
      running = false;
    }
  };
  void run();
  const interval = setInterval(() => void run(), 60000);
  interval.unref();
  return () => {
    stopped = true;
    lifetime.abort();
    clearInterval(interval);
  };
}

/** Small resumable batches share the interactive lookup queue and its daily budget. */
export async function enrichRestaurantLocations(
  store: RestaurantStore,
  landsd: Pick<LandsdSearch, 'search'>,
  now = Date.now,
  stopped = () => false,
  limit = 20,
) {
  let failures = 0,
    resolved = 0;
  for (const row of store.pending(now(), limit)) {
    if (stopped()) break;
    try {
      const cached = store.cachedLocation(row.address, now());
      const results = cached ? [cached] : await landsd.search(restaurantAddressQuery(row.address));
      if (stopped()) break;
      const match = matchRestaurantAddress(row, results);
      store.locate(row.id, row.address, match, now());
      if (match) resolved++;
      failures = 0;
    } catch {
      if (stopped()) break;
      store.defer(row.id, now());
      // Back off on a provider outage without treating one failed address as a full-day run.
      if (++failures >= 3) break;
    }
  }
  return resolved;
}
