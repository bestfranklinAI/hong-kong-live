import { expect, it, vi } from 'vitest';
import { Event as CesiumEvent, type CesiumWidget } from 'cesium';
import { NavigationCamera } from './NavigationCamera';
import type { UserLocation } from './UserLocation';

it('follows GPS, pauses on map interaction, recentres and releases its listeners', () => {
  const preRender = new CesiumEvent();
  const canvas = new EventTarget();
  const camera = { cancelFlight: vi.fn(), lookAt: vi.fn(), lookAtTransform: vi.fn() };
  const scene = { preRender, requestRender: vi.fn() };
  const user = { set: vi.fn(), clear: vi.fn(), setNavigating: vi.fn(), direction: () => 90 };
  const onFollow = vi.fn();
  const follow = new NavigationCamera(
    { canvas, camera, scene } as unknown as CesiumWidget,
    user as unknown as UserLocation,
    onFollow,
  );
  const fix = { lng: 114.16, lat: 22.28, accuracy: 10 };
  follow.set(true, true, fix, 8);
  preRender.raiseEvent();
  expect(camera.lookAt).toHaveBeenCalled();
  expect(camera.lookAt.mock.calls[0][1].range).toBe(260);
  expect(user.set).toHaveBeenLastCalledWith({ ...fix, z: 8 });
  const calls = camera.lookAt.mock.calls.length;
  canvas.dispatchEvent(new Event('pointerdown'));
  preRender.raiseEvent();
  expect(onFollow).toHaveBeenLastCalledWith(false);
  expect(camera.lookAt).toHaveBeenCalledTimes(calls);
  follow.set(true, true, { ...fix, lng: 114.161 }, 8);
  preRender.raiseEvent();
  expect(camera.lookAt.mock.calls.length).toBeGreaterThan(calls);
  const resumed = camera.lookAt.mock.calls.length;
  onFollow.mockClear();
  follow.pause();
  follow.pause();
  preRender.raiseEvent();
  expect(onFollow).toHaveBeenCalledExactlyOnceWith(false);
  expect(camera.lookAt).toHaveBeenCalledTimes(resumed);
  follow.set(true, true, { ...fix, accuracy: 80 });
  preRender.raiseEvent();
  expect(user.setNavigating).toHaveBeenLastCalledWith(false);
  expect(camera.lookAt).toHaveBeenCalledTimes(resumed);
  follow.set(true, true, fix);
  preRender.raiseEvent();
  expect(user.setNavigating).toHaveBeenLastCalledWith(true);
  expect(camera.lookAt.mock.calls.length).toBeGreaterThan(resumed);
  const recovered = camera.lookAt.mock.calls.length;
  follow.set(true, true, null);
  preRender.raiseEvent();
  expect(user.clear).toHaveBeenCalledOnce();
  expect(camera.lookAt).toHaveBeenCalledTimes(recovered);
  follow.set(false, false, null);
  onFollow.mockClear();
  follow.pause();
  expect(onFollow).not.toHaveBeenCalled();
  const before = camera.lookAt.mock.calls.length;
  preRender.raiseEvent();
  expect(camera.lookAt).toHaveBeenCalledTimes(before);
  follow.dispose();
  expect(preRender.numberOfListeners).toBe(0);
});
