import type { DataMode, Feed } from '@hk/contracts';
import { ProviderError, type SourceResult } from '@hk/providers';

export interface FeedPolicy {
  freshMs: number;
  serveMs: number;
  freshSourceMs: number;
  serveSourceMs: number;
}

interface CachedValue<T> {
  result: SourceResult<T>;
  fetchedAt: number;
}

interface CacheOptions<T> {
  provider: string;
  sourceUrl: string;
  load: () => Promise<SourceResult<T>>;
  policy: FeedPolicy;
  now: () => number;
  mode: DataMode;
}

/** Local-process cache only. A Worker isolate is not a global coordination boundary. */
export class FeedCache<T> {
  private value: CachedValue<T> | undefined;
  private pending: Promise<void> | undefined;
  private retryAt = 0;
  private attemptedAt: number | undefined;
  private lastError: string | undefined;

  constructor(private readonly options: CacheOptions<T>) {}

  async get(): Promise<Feed<T>> {
    const now = this.options.now();
    const fetchExpired = !this.value || now - this.value.fetchedAt >= this.options.policy.freshMs;
    if (fetchExpired && now >= this.retryAt) {
      // Create one shared promise before awaiting; requests can interleave at await points.
      if (!this.pending) {
        this.pending = this.refresh().finally(() => {
          this.pending = undefined;
        });
      }
      await this.pending;
    }
    return this.envelope();
  }

  private async refresh(): Promise<void> {
    this.attemptedAt = this.options.now();
    try {
      const result = await this.options.load();
      const previousTime = this.value?.result.sourceUpdatedAt;
      if (previousTime && result.sourceUpdatedAt && result.sourceUpdatedAt < previousTime) {
        throw new ProviderError(
          'Source returned an older update; retaining the last known observation.',
        );
      }
      this.value = { result, fetchedAt: this.options.now() };
      this.lastError = undefined;
      this.retryAt = 0;
    } catch (error) {
      this.lastError =
        error instanceof ProviderError
          ? error.message
          : 'The source could not be reached. Please try again shortly.';
      // A brief local cooldown avoids a burst of failures immediately hitting the source again.
      this.retryAt =
        this.options.now() +
        Math.max(5_000, error instanceof ProviderError ? (error.retryAfterMs ?? 0) : 0);
    }
  }

  private envelope(): Feed<T> {
    const { provider, sourceUrl, policy, mode } = this.options;
    const now = this.options.now();
    const sourceUpdatedAt = this.value?.result.sourceUpdatedAt ?? null;
    const fetchAge = this.value ? now - this.value.fetchedAt : Infinity;
    const sourceAge = sourceUpdatedAt ? now - Date.parse(sourceUpdatedAt) : null;
    const invalidSourceClock =
      sourceAge !== null && (!Number.isFinite(sourceAge) || sourceAge < -120_000);
    const expired =
      !this.value ||
      fetchAge >= policy.serveMs ||
      invalidSourceClock ||
      (sourceAge !== null && sourceAge >= policy.serveSourceMs);
    const stale =
      !!this.lastError ||
      fetchAge >= policy.freshMs ||
      sourceAge === null ||
      (sourceAge !== null && sourceAge >= policy.freshSourceMs);
    const status = expired ? 'unavailable' : stale ? 'stale' : 'fresh';
    const error =
      this.lastError ??
      (expired
        ? 'The latest source information is too old to display.'
        : sourceAge === null
          ? 'The source observation time is unknown.'
          : undefined);

    return {
      data: expired ? null : (this.value?.result.data ?? null),
      provider,
      sourceUrl,
      fetchedAt: new Date(this.value?.fetchedAt ?? this.attemptedAt ?? now).toISOString(),
      sourceUpdatedAt,
      status,
      mode,
      ...(error ? { error } : {}),
    };
  }
}

export const WEATHER_POLICY: FeedPolicy = {
  freshMs: 60_000,
  serveMs: 15 * 60_000,
  freshSourceMs: 45 * 60_000,
  serveSourceMs: 2 * 60 * 60_000,
};

export const ARRIVALS_POLICY: FeedPolicy = {
  freshMs: 30_000,
  serveMs: 90_000,
  freshSourceMs: 30_000,
  serveSourceMs: 90_000,
};
