// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { Event as CesiumEvent, type CesiumWidget } from 'cesium';
import { ScenePerformance } from './ScenePerformance';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('publishes aggregate city metrics and excludes background gaps from motion timing', () => {
  vi.useFakeTimers();
  vi.stubGlobal('PerformanceObserver', undefined);
  let hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  const start = new CesiumEvent(),
    end = new CesiumEvent(),
    draw = new CesiumEvent();
  const city = {
    state: 'loading' as const,
    network: 2,
    processing: 0,
    loaded: 4,
    unloaded: 0,
    failed: 0,
    memoryBytes: 1024,
    revealed: true,
    coverageReady: false,
    slow: false,
    firstVisibleMs: 1200,
    firstCoverageMs: null,
  };
  const widget = {
    camera: { moveStart: start, moveEnd: end },
    scene: {
      postRender: draw,
      globe: { tileLoadProgressEvent: new CesiumEvent(), tileCacheSize: 256 },
    },
    imageryLayers: { layerAdded: new CesiumEvent(), layerRemoved: new CesiumEvent(), length: 3 },
    canvas: { width: 390, height: 844, clientWidth: 390, clientHeight: 844 },
  } as unknown as CesiumWidget;
  const output = document.createElement('pre');
  const metrics = new ScenePerformance(widget, output, () => city);
  start.raiseEvent();
  draw.raiseEvent();
  vi.advanceTimersByTime(16);
  draw.raiseEvent();
  hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(10000);
  draw.raiseEvent();
  hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  draw.raiseEvent();
  vi.advanceTimersByTime(16);
  draw.raiseEvent();
  end.raiseEvent();
  vi.advanceTimersByTime(1000);
  const data = JSON.parse(output.textContent!);
  expect(data.city).toEqual(city);
  expect(data.visibility).toBe('visible');
  expect(data.lastMotion).toMatchObject({ samples: 1, medianMs: 16, p95Ms: 16 });
  expect(output.textContent).not.toMatch(/latitude|longitude|tileset\.json|key=/i);
  metrics.dispose();
  expect(vi.getTimerCount()).toBe(0);
  expect(draw.numberOfListeners).toBe(0);
});
