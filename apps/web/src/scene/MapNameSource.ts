import { Cartesian2, Cartographic, Math as CesiumMath, type CesiumWidget } from 'cesium';
import { LandsdMapLabels } from '@hk/providers/map-labels';
import type { MapNameLabel } from '@hk/contracts';
import type { MapLanguage } from './basemaps';

/** Fetch on settled views, with two requests at a time and cancellation of obsolete work. */
export class MapNameSource {
  private pending?: AbortController;
  private timer?: ReturnType<typeof setTimeout>;
  private removeMove: () => void;
  private language: MapLanguage = 'en';
  private enabled = true;
  private key = '';
  private retryAfter = 0;
  private disposed = false;
  private tracking = false;
  private trackingTimer?: ReturnType<typeof setInterval>;
  constructor(
    private widget: CesiumWidget,
    private changed: (rows: MapNameLabel[]) => void,
    private client: Pick<LandsdMapLabels, 'tile'> = new LandsdMapLabels(),
  ) {
    this.removeMove = widget.camera.moveEnd.addEventListener(() => this.schedule());
    this.schedule();
  }
  setLanguage(language: MapLanguage) {
    if (language === this.language) return;
    this.language = language;
    this.key = '';
    this.changed([]);
    this.schedule();
  }
  setVisible(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.syncTracking();
    if (enabled) this.schedule();
    else {
      clearTimeout(this.timer);
      this.pending?.abort();
      this.key = '';
    }
  }
  setTracking(tracking: boolean) {
    if (this.tracking === tracking) return;
    this.tracking = tracking;
    this.syncTracking();
  }
  private syncTracking() {
    clearInterval(this.trackingTimer);
    if (this.tracking && this.enabled && !this.disposed)
      this.trackingTimer = setInterval(() => this.schedule(), 5000);
  }
  private schedule() {
    clearTimeout(this.timer);
    if (!this.enabled || this.disposed) return;
    this.timer = setTimeout(() => void this.load(), 250);
  }
  private async load() {
    if (Date.now() < this.retryAfter) return;
    const { camera, canvas, scene } = this.widget;
    const centre = camera.pickEllipsoid(
      new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
      scene.globe.ellipsoid,
    );
    if (!centre || !this.enabled) return;
    const cartographic = Cartographic.fromCartesian(centre);
    const lng = CesiumMath.toDegrees(cartographic.longitude),
      lat = CesiumMath.toDegrees(cartographic.latitude);
    if (lng < 113.8 || lng > 114.5 || lat < 22.1 || lat > 22.6) return;
    const z =
      camera.positionCartographic.height > 8000
        ? 13
        : camera.positionCartographic.height > 3500
          ? 14
          : 15;
    const n = 2 ** z,
      x = Math.floor(((lng + 180) / 360) * n),
      y = Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
    const key = `${this.language}/${z}/${x}/${y}`;
    if (key === this.key) return;
    this.key = key;
    this.pending?.abort();
    const request = new AbortController();
    this.pending = request;
    const tiles = Array.from({ length: 9 }, (_, i) => ({
      x: x + (i % 3) - 1,
      y: y + Math.floor(i / 3) - 1,
    }));
    const rows: MapNameLabel[] = [];
    const language = this.language;
    let cursor = 0,
      failed = false;
    let publishedAt = 0;
    const publish = () => {
      if (request.signal.aborted || this.disposed) return;
      const seen = new Set<string>();
      const distance = (row: MapNameLabel) => Math.hypot(row.lng - lng, row.lat - lat);
      const selected = [...rows]
        .sort((a, b) => distance(a) - distance(b))
        .filter((row) => {
          const id = `${row.kind}:${row.text}`;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .slice(0, 100);
      this.changed(selected);
    };
    const worker = async () => {
      while (cursor < tiles.length && !request.signal.aborted) {
        const tile = tiles[cursor++]!;
        try {
          rows.push(...(await this.client.tile(z, tile.x, tile.y, language, request.signal)));
          if (rows.length && Date.now() - publishedAt > 300) {
            publish();
            publishedAt = Date.now();
          }
        } catch {
          if (!request.signal.aborted) failed = true;
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if (request.signal.aborted || this.disposed) return;
    if (failed) {
      this.key = '';
      this.retryAfter = Date.now() + 60000;
    }
    publish();
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.trackingTimer);
    clearTimeout(this.timer);
    this.pending?.abort();
    this.removeMove();
  }
}
