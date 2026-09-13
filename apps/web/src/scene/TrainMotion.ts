import {
  BillboardCollection,
  Cartesian3,
  Color,
  Credit,
  Material,
  NearFarScalar,
  PolylineCollection,
  SceneTransforms,
  type CesiumWidget,
} from 'cesium';
import { mtrLines, type Quality } from '@hk/contracts';
import { railSegments } from '../features/trains/network';
import {
  approaches,
  approachDistance,
  STATION_DWELL_MS,
  positionOnTrack,
  type TrainMotionInput,
} from '../features/trains/motion';
const sprite = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="52" viewBox="0 0 144 52"><g stroke="#173d55" stroke-width="2"><rect x="3" y="12" width="42" height="30" rx="9" fill="#eef6f5"/><rect x="50" y="12" width="42" height="30" rx="9" fill="#eef6f5"/><path d="M106 12h21q14 0 14 15v7q0 8-10 8h-25q-9 0-9-9V21q0-9 9-9" fill="#eef6f5"/><path d="M45 28h5m42 0h5"/></g><g fill="${color}"><rect x="5" y="32" width="38" height="6" rx="3"/><rect x="52" y="32" width="38" height="6" rx="3"/><rect x="100" y="32" width="37" height="6" rx="3"/></g><g fill="#244c60"><rect x="10" y="18" width="12" height="10" rx="3"/><rect x="27" y="18" width="12" height="10" rx="3"/><rect x="57" y="18" width="12" height="10" rx="3"/><rect x="74" y="18" width="12" height="10" rx="3"/><rect x="104" y="18" width="13" height="10" rx="3"/><path d="M123 17h5q8 0 9 11h-14z"/></g><circle cx="138" cy="34" r="2" fill="#ffdc81"/><g fill="#7891a0"><rect x="13" y="7" width="24" height="4" rx="2"/><rect x="60" y="7" width="24" height="4" rx="2"/></g></svg>`)}`;

/** At most one arrival illustration per station and direction; no vehicle IDs are inferred from arrival ordering. */
export class TrainMotion {
  private readonly trains: BillboardCollection;
  private readonly line: PolylineCollection;
  private input: TrainMotionInput | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private quality: Quality = 'balanced';
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly credit = new Credit(
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    true,
  );
  private visible = false;
  private readonly appearedAt = new Map<string, number>();
  private readonly onVisibility = () => this.restart();
  constructor(private widget: CesiumWidget) {
    this.trains = widget.scene.primitives.add(new BillboardCollection({ scene: widget.scene }));
    this.line = widget.scene.primitives.add(new PolylineCollection());
    this.line.show = false;
    document.addEventListener('visibilitychange', this.onVisibility);
    this.reduced.addEventListener('change', this.onVisibility);
    for (let i = 0; i < 54; i++)
      this.trains.add({
        position: Cartesian3.fromDegrees(114.16, 22.28, 35),
        image: sprite('#147bc1'),
        width: 96,
        height: 35,
        scaleByDistance: new NearFarScalar(2000, 1, 18000, 0.45),
        show: false,
        disableDepthTestDistance: Infinity,
      });
  }
  set(input: TrainMotionInput | null) {
    // Keep a just-arrived illustration through a feed refresh, but only within its dwell.
    // The new feed envelope still controls stale/delayed visibility.
    const now = Date.now();
    const active = new Set(approaches(this.input, now).map((row) => row.arrival.id));
    if (
      input?.stationFeeds &&
      this.input?.stationFeeds &&
      input.selection.line === this.input.selection.line
    ) {
      input = {
        ...input,
        stationFeeds: input.stationFeeds.map((entry) => {
          const previous = this.input?.stationFeeds?.find((item) => item.station === entry.station);
          if (!entry.feed?.data) return entry;
          const retained =
            previous?.feed?.data?.filter((arrival) => {
              const age = now - Date.parse(arrival.time);
              return (
                age >= 0 &&
                active.has(arrival.id) &&
                !entry.feed?.data?.some((next) => next.id === arrival.id)
              );
            }) ?? [];
          return { ...entry, feed: { ...entry.feed, data: [...retained, ...entry.feed.data] } };
        }),
      };
    }
    if (input?.selection.line !== this.input?.selection.line) {
      this.line.removeAll();
      const color =
        mtrLines.find((line) => line.code === input?.selection.line)?.color ?? '#147bc1';
      for (const segment of railSegments[input?.selection.line ?? ''] ?? [])
        this.line.add({
          positions: segment.coordinates.map((p) => Cartesian3.fromDegrees(p[0], p[1], 12)),
          width: 5,
          material: Material.fromType('Color', {
            color: Color.fromCssColorString(color).withAlpha(0.65),
          }),
        });
      const image = sprite(color);
      for (let i = 0; i < this.trains.length; i++) this.trains.get(i).image = image;
      this.appearedAt.clear();
    }
    this.input = input;
    this.line.show = Boolean(railSegments[input?.selection.line ?? '']);
    if (this.line.show) this.widget.creditDisplay.addStaticCredit(this.credit);
    else this.widget.creditDisplay.removeStaticCredit(this.credit);
    this.restart();
  }
  setQuality(quality: Quality) {
    this.quality = quality;
    this.restart();
  }
  private restart() {
    clearInterval(this.timer);
    this.tick();
    if (
      !document.hidden &&
      !this.reduced.matches &&
      this.input?.enabled &&
      railSegments[this.input.selection.line]
    )
      this.timer = setInterval(
        () => this.tick(),
        this.quality === 'efficient' ? 200 : this.quality === 'detailed' ? 33 : 66,
      );
    this.widget.scene.requestRender();
  }
  private tick() {
    const now = Date.now();
    const rows = document.hidden || this.reduced.matches ? [] : approaches(this.input, now);
    for (let i = 0; i < 54; i++) {
      const b = this.trains.get(i),
        row = rows[i];
      b.show = Boolean(row);
      if (!row) continue;
      const distance = approachDistance(row, now);
      const p = positionOnTrack(distance, row.segment),
        ahead = positionOnTrack(distance + (row.to > row.from ? 10 : -10), row.segment);
      b.position = Cartesian3.fromDegrees(p[0], p[1], 35);
      if (!this.appearedAt.has(row.arrival.id)) this.appearedAt.set(row.arrival.id, now);
      b.color = Color.WHITE.withAlpha(
        Math.min(
          1,
          (now - this.appearedAt.get(row.arrival.id)!) / 500,
          (row.endsAt + STATION_DWELL_MS - now) / 1000,
        ),
      );
      b.id = `train-approach:${row.arrival.id}`;
      const a = SceneTransforms.worldToWindowCoordinates(this.widget.scene, b.position);
      const c = SceneTransforms.worldToWindowCoordinates(
        this.widget.scene,
        Cartesian3.fromDegrees(ahead[0], ahead[1], 35),
      );
      if (a && c) b.rotation = Math.atan2(a.y - c.y, c.x - a.x);
    }
    const activeIds = new Set(rows.map((row) => row.arrival.id));
    for (const id of this.appearedAt.keys()) if (!activeIds.has(id)) this.appearedAt.delete(id);
    if (rows.length || this.visible) this.widget.scene.requestRender();
    this.visible = rows.length > 0;
  }
  pick(id: string) {
    return approaches(this.input, Date.now()).find((r) => `train-approach:${r.arrival.id}` === id);
  }
  dispose() {
    this.widget.creditDisplay.removeStaticCredit(this.credit);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.reduced.removeEventListener('change', this.onVisibility);
    clearInterval(this.timer);
    this.widget.scene.primitives.remove(this.trains);
    this.widget.scene.primitives.remove(this.line);
  }
}
