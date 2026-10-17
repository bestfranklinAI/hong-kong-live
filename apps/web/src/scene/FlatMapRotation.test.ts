import { expect, it, vi } from 'vitest';
import type { CesiumWidget } from 'cesium';
import { installFlatMapRotation } from './FlatMapRotation';

it('rotates heading in flat mode, preserves pinch events, resets fingers and removes listeners', () => {
  const canvas = new EventTarget();
  const setView = vi.fn();
  let enabled = true;
  const dispose = installFlatMapRotation(
    {
      canvas,
      camera: { heading: 0, setView },
      scene: { requestRender: vi.fn() },
    } as unknown as CesiumWidget,
    () => enabled,
  );
  const touch = (type: string, points: number[][]) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      touches: points.map(([x, y], identifier) => ({ clientX: x, clientY: y, identifier })),
    });
    canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  };
  touch('touchstart', [
    [0, 0],
    [10, 0],
  ]);
  touch('touchmove', [
    [0, 0],
    [20, 0],
  ]);
  touch('touchmove', [
    [0, 0],
    [0, 20],
  ]);
  expect(setView).toHaveBeenLastCalledWith({
    orientation: { heading: -Math.PI / 2, pitch: -Math.PI / 2, roll: 0 },
  });
  setView.mockClear();
  enabled = false;
  touch('touchmove', [
    [0, 0],
    [-20, 0],
  ]);
  expect(setView).not.toHaveBeenCalled();
  enabled = true;
  touch('touchend', [[0, 0]]);
  touch('touchstart', [
    [0, 0],
    [10, 0],
  ]);
  expect(setView).not.toHaveBeenCalled();
  dispose();
  touch('touchmove', [
    [0, 0],
    [0, 20],
  ]);
  expect(setView).not.toHaveBeenCalled();
});
