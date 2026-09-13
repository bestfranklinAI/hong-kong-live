import { expect, it, vi } from 'vitest';
import { type CesiumWidget, LabelCollection, PointPrimitiveCollection } from 'cesium';
import { MtrStations } from './MtrStations';

vi.mock('cesium', async (original) => {
  class Collection {
    show = true;
    entries: Record<string, unknown>[] = [];
    get length() {
      return this.entries.length;
    }
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
    PointPrimitiveCollection: Collection,
    LabelCollection: Collection,
  };
});

it('keeps station selection on its active line, reuses points and hides them outside MTR mode', () => {
  const owned: (PointPrimitiveCollection | LabelCollection)[] = [];
  const remove = vi.fn();
  const widget = {
    scene: {
      requestRender: vi.fn(),
      primitives: {
        add: (item: PointPrimitiveCollection | LabelCollection) => {
          owned.push(item);
          return item;
        },
        remove,
      },
    },
  } as unknown as CesiumWidget;
  const layer = new MtrStations(widget);
  layer.set({ line: 'EAL', station: 'SHT' });
  const first = owned[0].get(0);
  expect(layer.pick('mtr-station:ADM')).toEqual({ line: 'EAL', station: 'ADM' });
  expect(layer.pick('mtr-station:TST')).toBeUndefined();
  layer.set({ line: 'EAL', station: 'ADM' });
  expect(owned[0].get(0)).toBe(first);
  expect(owned[1].length).toBe(1);
  layer.set(null);
  expect(owned[0].show).toBe(false);
  expect(layer.pick('mtr-station:ADM')).toBeUndefined();
  layer.set({ line: 'ISL', station: 'ADM' });
  expect(layer.pick('mtr-station:ADM')).toEqual({ line: 'ISL', station: 'ADM' });
  expect(layer.pick('mtr-station:SHT')).toBeUndefined();
  layer.dispose();
  expect(remove).toHaveBeenCalledTimes(2);
});
