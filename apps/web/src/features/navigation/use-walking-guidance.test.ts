// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { walkingRouteSchema, type WalkingRoute } from '@hk/contracts';
import fixture from '../../../../../fixtures/providers/admiralty-routing-audit-2026-09-26.json';
import { useWalkingGuidance } from './use-walking-guidance';

let root: Root;
let value: ReturnType<typeof useWalkingGuidance>;
let success: PositionCallback;
let failure: PositionErrorCallback;
const clearWatch = vi.fn();
const watchPosition = vi.fn((ok: PositionCallback, bad: PositionErrorCallback) => {
  success = ok;
  failure = bad;
  return 42;
});
const release = vi.fn(async () => undefined);
const requestWake = vi.fn(async () => ({ released: false, release }));
function Harness(props: { route: WalkingRoute | null; active: boolean }) {
  value = useWalkingGuidance(props.route, props.active);
  return null;
}
const route = () => walkingRouteSchema.parse(fixture.routes['eal-ground']);
const render = async (route: WalkingRoute | null, active = true) => {
  await act(async () => root.render(createElement(Harness, { route, active })));
};
function position(route: WalkingRoute, accuracy = 10): GeolocationPosition {
  const [longitude, latitude] = route.paths[0][0];
  return {
    timestamp: Date.now(),
    coords: { longitude, latitude, accuracy, heading: 90, speed: 1 },
  } as GeolocationPosition;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', {
    geolocation: { watchPosition, clearWatch },
    wakeLock: { request: requestWake },
  });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('retains GPS and wake lock when replacing a route and releases them on trip end', async () => {
  const first = route();
  await render(first);
  await act(async () => success(position(first)));
  expect(value.fix).not.toBeNull();
  const remaining = value.progress!.remainingM;
  const replacement = { ...first, distanceM: first.distanceM * 2 };
  await render(replacement);
  expect(value.fix).not.toBeNull();
  expect(value.progress!.remainingM).toBeCloseTo(remaining * 2);
  expect(watchPosition).toHaveBeenCalledOnce();
  expect(requestWake).toHaveBeenCalledOnce();
  expect(clearWatch).not.toHaveBeenCalled();
  expect(release).not.toHaveBeenCalled();
  await render(replacement, false);
  expect(value.fix).toBeNull();
  expect(value.progress).toBeNull();
  expect(clearWatch).toHaveBeenCalledExactlyOnceWith(42);
  expect(release).toHaveBeenCalledOnce();
});

it('waits on poor fixes, expires lost GPS, and recovers without a new subscription', async () => {
  const trip = route();
  await render(trip);
  await act(async () => success(position(trip, 80)));
  expect(value.progress).toBeNull();
  expect(value.error).toContain('more accurate');
  await act(async () => success(position(trip)));
  expect(value.progress).not.toBeNull();
  expect(value.error).toBe('');
  await act(async () => vi.advanceTimersByTime(35000));
  expect(value.fix).toBeNull();
  expect(value.progress).toBeNull();
  expect(value.error).toContain('GPS signal lost');
  await act(async () => success(position(trip)));
  expect(value.fix).not.toBeNull();
  expect(value.progress).not.toBeNull();
  expect(value.error).toBe('');
  await act(async () => failure({ code: 1 } as GeolocationPositionError));
  expect(value.fix).toBeNull();
  expect(value.progress).toBeNull();
  expect(value.error).toContain('permission denied');
  expect(watchPosition).toHaveBeenCalledOnce();
});

it('coalesces pending wake requests and releases a lock granted after the trip ends', async () => {
  let grant!: (lock: { released: boolean; release: typeof release }) => void;
  requestWake.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  );
  const trip = route();
  await render(trip);
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(requestWake).toHaveBeenCalledOnce();
  await render(trip, false);
  await act(async () => grant({ released: false, release }));
  expect(release).toHaveBeenCalledOnce();
});

it('refreshes the GPS subscription on request and keeps the current route', async () => {
  const trip = route();
  await render(trip);
  await act(async () => success(position(trip)));
  expect(value.fix).not.toBeNull();
  await act(async () => value.refreshLocation());
  expect(clearWatch).toHaveBeenCalledExactlyOnceWith(42);
  expect(watchPosition).toHaveBeenCalledTimes(2);
  expect(value.fix).toBeNull();
  await act(async () => success(position(trip)));
  expect(value.progress).not.toBeNull();
});

it('retains walked geometry through GPS loss and clears it for a replacement route', async () => {
  const trip = route();
  trip.paths = [
    [
      [114.16, 22.3, 0],
      [114.161, 22.3, 0],
    ],
  ];
  await render(trip);
  const halfway = position(trip);
  Object.assign(halfway.coords, { longitude: 114.1605 });
  await act(async () => success(halfway));
  expect(value.completedM).toBeGreaterThan(40);
  const walked = value.completedM;
  await act(async () => vi.advanceTimersByTime(35000));
  expect(value.progress).toBeNull();
  expect(value.completedM).toBe(walked);
  await render({ ...trip });
  expect(value.completedM).toBe(0);
});
