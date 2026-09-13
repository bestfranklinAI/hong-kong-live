/** Share successful raw reports between independent observation views without coupling freshness. */
export function sharedWeatherReport(load: () => Promise<unknown>, now: () => number) {
  let cached: { body: unknown; at: number } | undefined;
  let pending: Promise<unknown> | undefined;
  return async () => {
    if (cached && now() - cached.at < 60_000) return cached.body;
    if (!pending)
      pending = load()
        .then((body) => {
          cached = { body, at: now() };
          return body;
        })
        .finally(() => {
          pending = undefined;
        });
    return pending;
  };
}
