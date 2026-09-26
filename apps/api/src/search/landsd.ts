import { fetchLandsd, type Fetcher } from '@hk/providers';
import type { SearchResult } from '@hk/contracts';

/** One bounded queue shared by interactive lookups and background address matching. */
export class LandsdSearch {
  private cache = new Map<string, { expires: number; rows: SearchResult[] }>();
  private pending = new Map<string, Promise<SearchResult[]>>();
  private tail: Promise<unknown> = Promise.resolve();
  private nextStart = 0;
  private day = '';
  private requests = 0;
  constructor(
    private fetcher: Fetcher,
    private now = Date.now,
    private dailyLimit = 1000,
  ) {}
  search(query: string): Promise<SearchResult[]> {
    const key = query.trim().toLowerCase();
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return Promise.resolve(cached.rows);
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.pending.size >= 4) return Promise.reject(new Error('Address lookup is busy.'));
    const task = this.tail
      .catch(() => undefined)
      .then(async () => {
        const day = new Date(this.now()).toISOString().slice(0, 10);
        if (this.day !== day) {
          this.day = day;
          this.requests = 0;
        }
        if (this.requests >= this.dailyLimit)
          throw new Error('Address lookup daily budget reached.');
        const wait = Math.max(0, this.nextStart - this.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        this.nextStart = this.now() + 1100;
        this.requests++;
        const rows = await fetchLandsd(query, this.fetcher);
        if (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { rows, expires: this.now() + (rows.length ? 86400000 : 600000) });
        return rows;
      })
      .finally(() => this.pending.delete(key));
    this.tail = task;
    this.pending.set(key, task);
    return task;
  }
}
