import { expect, it, vi } from 'vitest';
import { Cartographic, type CesiumWidget, type Cartesian3 } from 'cesium';
import { IndoorFloorLayer } from './IndoorFloorLayer';
import type { IndoorFloor } from '@hk/contracts';
vi.mock('cesium', async (original) => {
  class Lines {
    entries: { positions: Cartesian3[] }[] = [];
    add(v: { positions: Cartesian3[] }) {
      this.entries.push(v);
    }
    removeAll() {
      this.entries = [];
    }
  }
  return {
    ...(await original<typeof import('cesium')>()),
    PolylineCollection: Lines,
    Material: { fromType: vi.fn(() => ({})) },
  };
});
it('keeps rings separate, projects source Z, and clears the previous floor', () => {
  let lines: { entries: { positions: Cartesian3[] }[] };
  const remove = vi.fn();
  const widget = {
    scene: {
      primitives: {
        add: (v: typeof lines) => {
          lines = v;
          return v;
        },
        remove,
      },
      requestRender: vi.fn(),
    },
  } as unknown as CesiumWidget;
  const layer = new IndoorFloorLayer(widget);
  const ring: [number, number, number][] = [
    [114.19, 22.32, -9.9],
    [114.191, 22.32, -9.9],
    [114.19, 22.321, -9.9],
    [114.19, 22.32, -9.9],
  ];
  const floor: IndoorFloor = {
    id: 'floor',
    venueId: 'venue',
    name: 'Platform',
    nameZh: '月台',
    z: -9.9,
    polygons: [[ring, ring]],
  };
  expect(layer.set(floor)).toHaveLength(8);
  expect(lines!.entries).toHaveLength(2);
  expect(Cartographic.fromCartesian(lines!.entries[0].positions[0]).height).toBeCloseTo(2);
  expect(floor.polygons[0][0][0][2]).toBe(-9.9);
  const detail = {
    id: 'unit',
    venueId: 'venue',
    levelId: 'floor',
    category: 'room',
    name: '',
    z: -9.9,
    lines: [ring],
  };
  layer.set(floor, {
    units: [detail, { ...detail, id: 'other', levelId: 'another-floor' }],
    openings: [{ ...detail, id: 'opening', category: 'service' }],
    fetchedAt: '2026-09-26T00:00:00Z',
    sourceUpdatedAt: null,
  });
  expect(lines!.entries).toHaveLength(4);
  expect(Cartographic.fromCartesian(lines!.entries[2].positions[0]).height).toBeCloseTo(3);
  expect(Cartographic.fromCartesian(lines!.entries[3].positions[0]).height).toBeCloseTo(3.2);
  layer.set(undefined);
  expect(lines!.entries).toHaveLength(0);
  layer.dispose();
  expect(remove).toHaveBeenCalledTimes(1);
});
