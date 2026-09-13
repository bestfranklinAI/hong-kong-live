import { expect, it, vi } from 'vitest';
import { sharedWeatherReport } from './weather-report';
it('shares concurrent report loads and refreshes only after expiry', async () => {
  let now = 0;
  const load = vi.fn(async () => ({ temperature: 1 }));
  const report = sharedWeatherReport(load, () => now);
  await Promise.all([report(), report()]);
  expect(load).toHaveBeenCalledTimes(1);
  now = 59_999;
  await report();
  expect(load).toHaveBeenCalledTimes(1);
  now = 60_000;
  await report();
  expect(load).toHaveBeenCalledTimes(2);
});
it('does not cache a failed load', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true });
  const report = sharedWeatherReport(load, () => 0);
  await expect(report()).rejects.toThrow('offline');
  await expect(report()).resolves.toEqual({ ok: true });
});
