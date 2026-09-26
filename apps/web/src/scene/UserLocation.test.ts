import { afterEach, expect, it, vi } from 'vitest';
import { Event as CesiumEvent, type CesiumWidget } from 'cesium';
import { UserLocation } from './UserLocation';
vi.mock('cesium', async (original) => {
  class Collection {
    entries: Record<string, unknown>[] = [];
    add(value: Record<string, unknown>) {
      this.entries.push(value);
      return value;
    }
    get(index: number) {
      return this.entries[index];
    }
    removeAll() {
      this.entries = [];
    }
  }
  return {
    ...(await original<typeof import('cesium')>()),
    Material: { fromType: () => ({}) },
    BillboardCollection: Collection,
    PolylineCollection: Collection,
    SceneTransforms: { worldToWindowCoordinates: () => ({ x: 10, y: 20 }) },
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('shows a GPS fix without fabricating heading, expires compass data and releases listeners', () => {
  vi.useFakeTimers();
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  vi.stubGlobal('screen', { orientation: { angle: 0 } });
  const collections: { entries: Record<string, unknown>[] }[] = [];
  const preRender = new CesiumEvent();
  const remove = vi.fn();
  const layer = new UserLocation({
    scene: {
      preRender,
      requestRender: vi.fn(),
      primitives: {
        add: (collection: (typeof collections)[number]) => {
          collections.push(collection);
          return collection;
        },
        remove,
      },
    },
  } as unknown as CesiumWidget);
  layer.set({ lng: 114.16, lat: 22.3, accuracy: 20 });
  preRender.raiseEvent();
  expect(collections[0].entries[1].show).toBe(true);
  expect(collections[0].entries[0].show).toBe(false);
  expect(collections[1].entries[0].positions).toHaveLength(65);
  const compass = Object.assign(new Event('deviceorientationabsolute'), {
    absolute: true,
    alpha: 90,
  });
  target.dispatchEvent(compass);
  preRender.raiseEvent();
  expect(collections[0].entries[0].show).toBe(true);
  vi.advanceTimersByTime(10001);
  preRender.raiseEvent();
  expect(collections[0].entries[0].show).toBe(false);
  layer.dispose();
  expect(remove).toHaveBeenCalledTimes(2);
  expect(preRender.numberOfListeners).toBe(0);
});
