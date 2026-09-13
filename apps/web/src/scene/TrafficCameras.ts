import {
  Cartesian3,
  Color,
  PointPrimitiveCollection,
  type CesiumWidget,
  type PointPrimitive,
} from 'cesium';
import type { TrafficCamera } from '@hk/contracts';

/** One batched primitive collection; image previews never become map textures. */
export class TrafficCameras {
  private readonly points: PointPrimitiveCollection;
  private source: TrafficCamera[] | undefined;
  private entries = new Map<string, { camera: TrafficCamera; point: PointPrimitive }>();
  constructor(private widget: CesiumWidget) {
    this.points = widget.scene.primitives.add(new PointPrimitiveCollection());
  }
  set(cameras: TrafficCamera[] | undefined, selectedId?: string) {
    if (cameras !== this.source) {
      this.source = cameras;
      this.points.removeAll();
      this.entries.clear();
      for (const camera of cameras ?? []) {
        const point = this.points.add({
          id: `traffic-camera:${camera.id}`,
          position: Cartesian3.fromDegrees(camera.lng, camera.lat, 5),
          pixelSize: 8,
          outlineColor: Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Infinity,
        });
        this.entries.set(camera.id, { camera, point });
      }
    }
    for (const [id, { point }] of this.entries) {
      point.pixelSize = id === selectedId ? 16 : 8;
      point.color = Color.fromCssColorString(id === selectedId ? '#147d73' : '#c88738');
    }
    this.widget.scene.requestRender();
  }
  pick(id: string) {
    return this.entries.get(id.replace(/^traffic-camera:/, ''))?.camera;
  }
  dispose() {
    this.widget.scene.primitives.remove(this.points);
    this.entries.clear();
  }
}
