import { expect, it, vi } from 'vitest';
import { stationFloorRequest } from './station-floor-requests';
it('serialises floor reads, skips obsolete queued work, and releases capacity after failures', async () => {
  let release: (() => void) | undefined;
  const first = stationFloorRequest(
    new AbortController().signal,
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const controller = new AbortController();
  const staleRead = vi.fn(async () => 1);
  const stale = stationFloorRequest(controller.signal, staleRead);
  const staleResult = expect(stale).rejects.toThrow();
  const nextRead = vi.fn(async () => 2);
  const next = stationFloorRequest(new AbortController().signal, nextRead);
  await Promise.resolve();
  expect(nextRead).not.toHaveBeenCalled();
  controller.abort();
  release?.();
  await first;
  await staleResult;
  expect(await next).toBe(2);
  expect(staleRead).not.toHaveBeenCalled();
  await expect(
    stationFloorRequest(new AbortController().signal, async () => {
      throw new Error('source down');
    }),
  ).rejects.toThrow('source down');
  expect(await stationFloorRequest(new AbortController().signal, async () => 3)).toBe(3);
});
