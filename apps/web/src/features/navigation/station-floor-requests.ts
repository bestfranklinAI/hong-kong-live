let tail: Promise<void> = Promise.resolve();
/** Leave source capacity for the selected floor's amenities/layout; queued obsolete work never fetches. */
export async function stationFloorRequest<T>(
  signal: AbortSignal,
  load: () => Promise<T>,
): Promise<T> {
  const previous = tail;
  let release: (() => void) | undefined;
  tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    signal.throwIfAborted();
    return await load();
  } finally {
    release?.();
  }
}
