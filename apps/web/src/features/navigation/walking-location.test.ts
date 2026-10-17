import { afterEach, expect, it, vi } from 'vitest';
import { watchWalkingLocation } from './walking-location';
afterEach(() => vi.useRealTimers());
it('rejects stale fixes, expires accepted fixes, and cancels late callbacks after stopping', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T08:00:00Z'));
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback = () => {};
  const geo = {
    watchPosition: vi.fn((ok: PositionCallback, bad: PositionErrorCallback) => {
      success = ok;
      failure = bad;
      return 42;
    }),
    clearWatch: vi.fn(),
  };
  const fix = vi.fn(),
    error = vi.fn();
  const stop = watchWalkingLocation(geo as unknown as Geolocation, fix, error);
  const position = (timestamp = Date.now()) =>
    ({
      timestamp,
      coords: { latitude: 22.28, longitude: 114.16, accuracy: 10, heading: 90, speed: 1 },
    }) as GeolocationPosition;
  success(position(Date.now() - 31000));
  expect(fix).not.toHaveBeenCalled();
  success(position());
  expect(fix).toHaveBeenLastCalledWith(expect.objectContaining({ lat: 22.28, heading: 90 }));
  vi.advanceTimersByTime(35000);
  expect(fix).toHaveBeenLastCalledWith(null);
  expect(error).toHaveBeenLastCalledWith(expect.stringContaining('GPS signal lost'));
  failure({ code: 1 } as GeolocationPositionError);
  expect(error).toHaveBeenLastCalledWith(expect.stringContaining('permission denied'));
  stop();
  expect(geo.clearWatch).toHaveBeenCalledWith(42);
  const calls = fix.mock.calls.length;
  success(position());
  expect(fix).toHaveBeenCalledTimes(calls);
});
it('does not turn a stationary course into facing direction', () => {
  vi.useFakeTimers();
  const fix = vi.fn();
  let success: PositionCallback = () => {};
  const geo = {
    watchPosition: (ok: PositionCallback) => {
      success = ok;
      return 1;
    },
    clearWatch: vi.fn(),
  };
  const stop = watchWalkingLocation(geo as unknown as Geolocation, fix, vi.fn());
  success({
    timestamp: Date.now(),
    coords: { latitude: 22.28, longitude: 114.16, accuracy: 10, heading: 90, speed: 0 },
  } as GeolocationPosition);
  expect(fix).toHaveBeenLastCalledWith(expect.objectContaining({ heading: undefined }));
  stop();
});
it('keeps fixes chronological, clears a denied fix, and recovers on a new position', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T08:00:00Z'));
  let success: PositionCallback = () => {};
  let failure: PositionErrorCallback = () => {};
  const geo = {
    watchPosition: (ok: PositionCallback, bad: PositionErrorCallback) => {
      success = ok;
      failure = bad;
      return 7;
    },
    clearWatch: vi.fn(),
  };
  const fix = vi.fn(),
    error = vi.fn();
  const stop = watchWalkingLocation(geo as unknown as Geolocation, fix, error);
  const position = (timestamp: number, latitude = 22.28) =>
    ({
      timestamp,
      coords: { latitude, longitude: 114.16, accuracy: 10, heading: null, speed: null },
    }) as GeolocationPosition;
  success(position(Date.now()));
  const accepted = fix.mock.calls.length;
  success(position(Date.now() - 1000));
  success(position(Date.now(), 91));
  expect(fix).toHaveBeenCalledTimes(accepted);
  failure({ code: 1 } as GeolocationPositionError);
  expect(fix).toHaveBeenLastCalledWith(null);
  vi.advanceTimersByTime(35000);
  expect(error).toHaveBeenLastCalledWith(expect.stringContaining('permission denied'));
  success(position(Date.now()));
  expect(error).toHaveBeenLastCalledWith('');
  expect(fix).toHaveBeenLastCalledWith(expect.objectContaining({ timestamp: Date.now() }));
  stop();
});
