import {
  Cartesian2,
  Cartesian3,
  Color,
  LabelCollection,
  LabelStyle,
  HorizontalOrigin,
  PointPrimitiveCollection,
  type CesiumWidget,
} from 'cesium';
import type { BusStop } from '@hk/contracts';

/** Route stops are reference points; no straight-line road geometry is inferred. */
export class BusStops {
  private points: PointPrimitiveCollection;
  private labels: LabelCollection;
  private source?: BusStop[];
  private selected?: number;
  constructor(private widget: CesiumWidget) {
    this.points = widget.scene.primitives.add(new PointPrimitiveCollection());
    this.labels = widget.scene.primitives.add(new LabelCollection({ scene: widget.scene }));
  }
  set(stops: BusStop[] | undefined, selected: BusStop | null) {
    if (stops === this.source && selected?.seq === this.selected) return;
    this.points.show = this.labels.show = Boolean(stops);
    if (stops !== this.source) {
      this.source = stops;
      this.points.removeAll();
      for (const stop of stops ?? [])
        this.points.add({
          id: `bus-stop:${stop.seq}`,
          position: Cartesian3.fromDegrees(stop.lng, stop.lat, 8),
          pixelSize: 9,
          color: Color.fromCssColorString('#b96e42'),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Infinity,
        });
    }
    this.selected = selected?.seq;
    for (let i = 0; i < this.points.length; i++)
      this.points.get(i).pixelSize = this.points.get(i).id === `bus-stop:${selected?.seq}` ? 19 : 9;
    this.labels.removeAll();
    if (selected)
      this.labels.add({
        id: `bus-stop:${selected.seq}`,
        position: Cartesian3.fromDegrees(selected.lng, selected.lat, 8),
        text: `${selected.seq}. ${selected.name.length > 30 ? `${selected.name.slice(0, 29)}…` : selected.name}`,
        horizontalOrigin: HorizontalOrigin.CENTER,
        font: '600 12px system-ui, sans-serif',
        fillColor: Color.fromCssColorString('#75421f'),
        outlineColor: Color.WHITE,
        outlineWidth: 4,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -25),
        disableDepthTestDistance: Infinity,
      });
    this.widget.scene.requestRender();
  }
  pick(id: string) {
    return this.points.show ? this.source?.find((s) => `bus-stop:${s.seq}` === id) : undefined;
  }
  dispose() {
    this.widget.scene.primitives.remove(this.points);
    this.widget.scene.primitives.remove(this.labels);
  }
}
