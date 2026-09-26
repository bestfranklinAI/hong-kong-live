import { TrainJourneys, type Journey } from '../features/trains/journeys';
import { shouldShowTrainBadge } from './train-presentation';
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
import { positionOnTrack, type TrainMotionInput } from '../features/trains/motion';
const sprite = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="52" viewBox="0 0 144 52"><g stroke="#173d55" stroke-width="2"><rect x="3" y="12" width="42" height="30" rx="9" fill="#eef6f5"/><rect x="50" y="12" width="42" height="30" rx="9" fill="#eef6f5"/><path d="M106 12h21q14 0 14 15v7q0 8-10 8h-25q-9 0-9-9V21q0-9 9-9" fill="#eef6f5"/><path d="M45 28h5m42 0h5"/></g><g fill="${color}"><rect x="5" y="32" width="38" height="6" rx="3"/><rect x="52" y="32" width="38" height="6" rx="3"/><rect x="100" y="32" width="37" height="6" rx="3"/></g><g fill="#244c60"><rect x="10" y="18" width="12" height="10" rx="3"/><rect x="27" y="18" width="12" height="10" rx="3"/><rect x="57" y="18" width="12" height="10" rx="3"/><rect x="74" y="18" width="12" height="10" rx="3"/><rect x="104" y="18" width="13" height="10" rx="3"/><path d="M123 17h5q8 0 9 11h-14z"/></g><circle cx="138" cy="34" r="2" fill="#ffdc81"/><g fill="#7891a0"><rect x="13" y="7" width="24" height="4" rx="2"/><rect x="60" y="7" width="24" height="4" rx="2"/></g></svg>`)}`;

const badge = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect x="3" y="3" width="42" height="42" rx="14" fill="white" stroke="${color}" stroke-width="3"/><rect x="14" y="10" width="20" height="26" rx="6" fill="${color}"/><rect x="17" y="14" width="14" height="10" rx="3" fill="white"/><circle cx="19" cy="30" r="2" fill="white"/><circle cx="29" cy="30" r="2" fill="white"/><path d="m18 36-3 4m15-4 3 4" stroke="${color}" stroke-width="2"/></svg>`)}`;

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
  private cartImage = sprite('#147bc1');
  private badgeImage = badge('#147bc1');
  private oblique = false;
  private readonly journeys = new TrainJourneys();
  private renderedJourneys: Journey[] = [];
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
      this.cartImage = sprite(color);
      this.badgeImage = badge(color);
      this.journeys.reset();
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
    // These are screen annotations, not surveyed rolling stock. Hysteresis avoids
    // flickering between the top-view carriage and upright badge near the threshold.
    this.oblique = shouldShowTrainBadge(this.widget.camera.pitch, this.oblique);
    const rows =
      document.hidden || this.reduced.matches ? [] : this.journeys.update(this.input, now);
    this.renderedJourneys = rows;
    for (let i = 0; i < 54; i++) {
      const b = this.trains.get(i),
        journey = rows[i],
        row = journey?.row;
      b.show = Boolean(row);
      if (!row) continue;
      b.image = this.oblique ? this.badgeImage : this.cartImage;
      b.width = this.oblique ? 38 : 96;
      b.height = this.oblique ? 38 : 35;
      const distance = journey.distance;
      const p = positionOnTrack(distance, row.segment),
        ahead = positionOnTrack(distance + (row.to > row.from ? 10 : -10), row.segment);
      b.position = Cartesian3.fromDegrees(p[0], p[1], 35);
      b.color = Color.WHITE.withAlpha(
        Math.max(
          0,
          Math.min(
            1,
            (now - journey.bornAt) / 500,
            journey.retiredAt === undefined ? 1 : 1 - (now - journey.retiredAt) / 1000,
          ),
        ),
      );
      b.id = `train-approach:${journey.id}`;
      const a = SceneTransforms.worldToWindowCoordinates(this.widget.scene, b.position);
      const c = SceneTransforms.worldToWindowCoordinates(
        this.widget.scene,
        Cartesian3.fromDegrees(ahead[0], ahead[1], 35),
      );
      b.rotation = !this.oblique && a && c ? Math.atan2(a.y - c.y, c.x - a.x) : 0;
    }
    if (rows.length || this.visible) this.widget.scene.requestRender();
    this.visible = rows.length > 0;
  }
  pick(id: string) {
    return this.renderedJourneys.find((journey) => `train-approach:${journey.id}` === id)?.row;
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
