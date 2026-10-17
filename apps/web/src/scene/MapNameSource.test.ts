import { afterEach, expect, it, vi } from 'vitest';
import { Cartesian3, Ellipsoid, Event as CesiumEvent, type CesiumWidget } from 'cesium';
import type { MapNameLabel } from '@hk/contracts';
import type { LandsdMapLabels } from '@hk/providers/map-labels';
import { MapNameSource } from './MapNameSource';
afterEach(() => vi.useRealTimers());
it('limits concurrent tile requests and cancels pending and late work on disposal', async () => {
  vi.useFakeTimers();
  const moveEnd = new CesiumEvent();
  const widget = {
    camera: {
      moveEnd,
      pickEllipsoid: () => Cartesian3.fromDegrees(114.164, 22.279),
      positionCartographic: { height: 1500 },
    },
    canvas: { clientWidth: 390, clientHeight: 844 },
    scene: { globe: { ellipsoid: Ellipsoid.WGS84 } },
  } as unknown as CesiumWidget;
  const finishes: Array<(rows: MapNameLabel[]) => void> = [];
  const tile = vi.fn<LandsdMapLabels['tile']>(
    () =>
      new Promise((resolve) => {
        finishes.push(resolve);
      }),
  );
  const changed = vi.fn();
  const source = new MapNameSource(widget, changed, { tile });
  vi.advanceTimersByTime(250);
  expect(tile).toHaveBeenCalledTimes(2);
  finishes[0]!([]);
  await Promise.resolve();
  await Promise.resolve();
  expect(tile).toHaveBeenCalledTimes(3);
  source.dispose();
  expect(tile.mock.calls[0]![4].aborted).toBe(true);
  finishes[1]!([]);
  finishes[2]!([]);
  await Promise.resolve();
  await Promise.resolve();
  expect(changed).not.toHaveBeenCalled();
  expect(moveEnd.numberOfListeners).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
