import { createHash } from 'node:crypto';
import {
  FEHD_URLS,
  fetchCatalogueXml,
  mergeFehd,
  matchRestaurantAddress,
  restaurantAddressQuery,
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
  let stopped = false,
    running = false,
    lastAttempt = 0,
    enrichedDay = '';
  const run = async () => {
    if (stopped || running) return;
    const now = Date.now(),
      status = store.status(now),
      due = expectedCatalogueDate(now);
    const refreshDue = (status.sourceDate ?? '') < due;
    if ((!refreshDue && enrichedDay === due) || now - lastAttempt < 3600000) return;
    running = true;
    lastAttempt = now;
    try {
      if (refreshDue) {
        const count = await importRestaurants(store, fetcher);
        console.info(
          `Restaurant catalogue ready: ${count} licences, source ${store.status(Date.now()).sourceDate}.`,
        );
      }
      if (enrichedDay !== due) {
        enrichedDay = due;
        for (const row of store.pending(Date.now(), 100)) {
          if (stopped) break;
          try {
            const results = await landsd.search(restaurantAddressQuery(row.address));
            store.locate(row.id, row.address, matchRestaurantAddress(row, results), Date.now());
          } catch {
            break;
          }
        }
      }
    } catch {
      console.warn(
        'Restaurant refresh unavailable; keeping the last validated catalogue. Retrying in one hour.',
      );
    } finally {
      running = false;
    }
  };
  void run();
  const interval = setInterval(() => void run(), 60000);
  interval.unref();
  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
