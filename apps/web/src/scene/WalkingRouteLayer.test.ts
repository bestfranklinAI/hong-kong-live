import { expect, it, vi } from 'vitest';
import { type CesiumWidget, PrimitiveCollection, PointPrimitiveCollection } from 'cesium';
import { WalkingRouteLayer, routeDisplayPaths } from './WalkingRouteLayer';
import { walkingRouteSchema } from '@hk/contracts';
import fixture from '../../../../fixtures/providers/admiralty-routing-audit-2026-09-26.json';
vi.mock('cesium', async (original) => {
  class Collection {
    entries: unknown[] = [];
    get length() {
      return this.entries.length;
    }
    add(item: unknown) {
      this.entries.push(item);
      return item;
    }
    removeAll() {
      this.entries = [];
    }
  }
  return {
    ...(await original<typeof import('cesium')>()),
    PrimitiveCollection: Collection,
    Primitive: class {
      constructor(options: object) {
        Object.assign(this, options);
      }
    },
    PointPrimitiveCollection: Collection,
    Material: { fromType: vi.fn(() => ({})) },
  };
});
it('keeps geometry in 3D, toggles occlusion without reframing, and clears on close', () => {
  const collections: (PrimitiveCollection | PointPrimitiveCollection)[] = [];
  const widget = {
    scene: {
      primitives: {
        add: (item: PrimitiveCollection | PointPrimitiveCollection) => {
          collections.push(item);
          return item;
        },
        remove: vi.fn(),
      },
      requestRender: vi.fn(),
    },
    camera: { flyToBoundingSphere: vi.fn() },
  } as unknown as CesiumWidget;
  const layer = new WalkingRouteLayer(widget);
  const route = walkingRouteSchema.parse(fixture.routes['eal-ground']);
  layer.set(route);
  expect(collections[0].length).toBeGreaterThan(0);
  expect(collections[1].length).toBe(2);
  layer.set(route, true);
  expect(collections[0].length).toBeGreaterThan(0);
  expect(collections[1].length).toBe(2);
  const frames = vi.mocked(widget.camera.flyToBoundingSphere).mock.calls.length;
  layer.set(route, true, true);
  expect(widget.camera.flyToBoundingSphere).toHaveBeenCalledTimes(frames);
  layer.set(route, false);
  expect(collections[0].length).toBeGreaterThan(0);
  layer.set(null);
  expect(collections.map((c) => c.length)).toEqual([0, 0]);
});

it('preserves source Z and splits missing-height gaps without affecting 2D coverage', () => {
  const route = walkingRouteSchema.parse(fixture.routes['eal-ground']);
  route.paths = [
    [
      [114.16, 22.28, -10],
      [114.16, 22.28, 5],
      [114.161, 22.28, null],
      [114.162, 22.28, 8],
      [114.163, 22.28, 9],
    ],
  ];
  expect(routeDisplayPaths(route, true)).toEqual([
    [
      [114.16, 22.28, -10],
      [114.16, 22.28, 5],
    ],
    [
      [114.162, 22.28, 8],
      [114.163, 22.28, 9],
    ],
  ]);
  expect(routeDisplayPaths(route, false)[0].map((p) => p[2])).toEqual([3, 3, 3, 3, 3]);
});
