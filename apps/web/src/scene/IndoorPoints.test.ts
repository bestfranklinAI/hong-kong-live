import { expect, it, vi } from 'vitest';
import { BillboardCollection, Cartesian2, SceneTransforms, type CesiumWidget } from 'cesium';
import { IndoorPoints } from './IndoorPoints';
import type { IndoorPoint } from '@hk/contracts';
vi.mock('cesium', async (original) => {
  class Collection {
    entries: unknown[] = [];
    add(v: unknown) {
      this.entries.push(v);
      return v;
    }
    removeAll() {
      this.entries = [];
    }
    get length() {
      return this.entries.length;
    }
    get(i: number) {
      return this.entries[i];
    }
  }
  return {
    ...(await original<typeof import('cesium')>()),
    BillboardCollection: Collection,
    PolylineCollection: Collection,
  };
});
it('clears old-level picks, numbers markers and disposes its renderer collection', () => {
  let collection: BillboardCollection;
  const remove = vi.fn();
  const widget = {
    scene: {
      primitives: {
        add: (c: BillboardCollection) => {
          collection = c;
          return c;
        },
        remove,
      },
      requestRender: vi.fn(),
    },
  } as unknown as CesiumWidget;
  const layer = new IndoorPoints(widget);
  const p: IndoorPoint = {
    id: 'point-a',
    venueId: 'venue',
    levelId: 'concourse',
    name: 'Exit A',
    nameZh: 'A出口',
    levelName: 'Concourse',
    levelNameZh: '大堂',
    category: 'entry',
    lat: 22.326335,
    lng: 114.191692,
    z: -3.53,
  };
  expect(layer.set([p])?.lat).toBeCloseTo(p.lat, 5);
  expect(collection!.length).toBe(1);
  expect(collection!.get(0).width).toBe(44);
  expect(layer.pick('indoor-point:point-a')).toBe(p);
  vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockReturnValue(new Cartesian2(100, 100));
  expect(layer.pickAt(new Cartesian2(121, 100))).toBe(p);
  expect(layer.pickAt(new Cartesian2(124, 100))).toBeUndefined();
  layer.select(p.id);
  expect(collection!.get(0).scale).toBe(1.2);
  expect(decodeURIComponent(String(collection!.get(0).image))).toContain('#087f8c');
  expect(layer.pickAt(new Cartesian2(124, 100))).toBe(p);
  layer.select(undefined);
  expect(collection!.get(0).scale).toBe(1);
  expect(layer.pickAt(new Cartesian2(124, 100))).toBeUndefined();
  layer.set([{ ...p, id: 'point-b', levelId: 'platform', z: -9.9 }]);
  expect(layer.pick('indoor-point:point-a')).toBeUndefined();
  expect(layer.pick('indoor-point:point-b')?.levelId).toBe('platform');
  expect(layer.set(undefined)).toBeNull();
  expect(collection!.length).toBe(0);
  expect(layer.pickAt(new Cartesian2(100, 100))).toBeUndefined();
  vi.restoreAllMocks();
  layer.dispose();
  expect(remove).toHaveBeenCalledTimes(2);
});
