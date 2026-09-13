import type { CesiumWidget } from 'cesium';

function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 10) / 10;
}

/** Local opt-in measurements only. No analytics requests or per-frame React updates. */
export class ScenePerformance {
  private cleanups: Array<() => void> = [];
  private observer?: PerformanceObserver;
  private timer: number;
  private started = performance.now();
  private frames = 0;
  private previousFrames = 0;
  private moving = false;
  private lastFrame = 0;
  private intervals: number[] = [];
  private lastMotion: object | null = null;
  private pending = 0;
  private loadingStarted: number | null = null;
  private lastLoadMs: number | null = null;
  private firstSettledMs: number | null = null;
  private added = 0;
  private removed = 0;
  private resources = { background: 0, labels: 0, other: 0 };
  private durations: number[] = [];

  constructor(
    private widget: CesiumWidget,
    private output: HTMLElement,
  ) {
    const { scene, camera, imageryLayers } = widget;
    this.cleanups.push(
      camera.moveStart.addEventListener(() => {
        this.moving = true;
        this.lastFrame = 0;
        this.intervals = [];
      }),
    );
    this.cleanups.push(
      camera.moveEnd.addEventListener(() => {
        this.moving = false;
        this.lastMotion = {
          samples: this.intervals.length,
          medianMs: percentile(this.intervals, 0.5),
          p95Ms: percentile(this.intervals, 0.95),
          over33ms: this.intervals.filter((t) => t > 33).length,
        };
      }),
    );
    this.cleanups.push(
      scene.postRender.addEventListener(() => {
        this.frames++;
        const now = performance.now();
        if (this.moving && this.lastFrame && this.intervals.length < 3600)
          this.intervals.push(now - this.lastFrame);
        this.lastFrame = now;
      }),
    );
    this.cleanups.push(
      scene.globe.tileLoadProgressEvent.addEventListener((pending: number) => {
        this.pending = pending;
        if (pending && this.loadingStarted === null) this.loadingStarted = performance.now();
        if (!pending && this.loadingStarted !== null) {
          this.lastLoadMs = Math.round(performance.now() - this.loadingStarted);
          this.firstSettledMs ??= Math.round(performance.now() - this.started);
          this.loadingStarted = null;
        }
      }),
    );
    this.cleanups.push(imageryLayers.layerAdded.addEventListener(() => this.added++));
    this.cleanups.push(imageryLayers.layerRemoved.addEventListener(() => this.removed++));
    if (typeof PerformanceObserver !== 'undefined') {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const url = new URL(entry.name);
          if (!['mapapi.geodata.gov.hk', 'tile.openstreetmap.org'].includes(url.hostname)) continue;
          const kind = url.pathname.includes('/label/')
            ? 'labels'
            : url.pathname.includes('/basemap/') || url.pathname.includes('/imagery/')
              ? 'background'
              : 'other';
          this.resources[kind]++;
          if (this.durations.length === 1000) this.durations.shift();
          this.durations.push(entry.duration);
        }
      });
      this.observer.observe({ type: 'resource', buffered: true });
    }
    this.timer = window.setInterval(() => this.publish(), 1000);
  }

  private publish() {
    if (document.hidden) return;
    this.output.textContent = JSON.stringify(
      {
        elapsedMs: Math.round(performance.now() - this.started),
        drawsSinceLastSample: this.frames - this.previousFrames,
        totalDraws: this.frames,
        moving: this.moving,
        lastMotion: this.lastMotion,
        pendingTiles: this.pending,
        firstQueueSettledMs: this.firstSettledMs,
        lastLoadingEpisodeMs: this.lastLoadMs,
        layersAdded: this.added,
        layersRemoved: this.removed,
        layerCount: this.widget.imageryLayers.length,
        tileResourceCompletions: this.resources,
        resourceDurationP95Ms: percentile(this.durations, 0.95),
        globeCacheTiles: this.widget.scene.globe.tileCacheSize,
        canvas: { width: this.widget.canvas.width, height: this.widget.canvas.height },
        viewport: {
          width: this.widget.canvas.clientWidth,
          height: this.widget.canvas.clientHeight,
        },
      },
      null,
      2,
    );
    this.previousFrames = this.frames;
  }

  dispose() {
    clearInterval(this.timer);
    this.observer?.disconnect();
    this.cleanups.forEach((remove) => remove());
  }
}
