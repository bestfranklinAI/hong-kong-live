import {
  ArcType,
  Cartesian3,
  Color,
  GeometryInstance,
  Material,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  PrimitiveCollection,
  PointPrimitiveCollection,
  type CesiumWidget,
} from 'cesium';
import type { PedestrianNetwork } from '@hk/contracts';

/** Context is projected separately from the prominent route; HKPD is never used as ellipsoid height. */
export class PedestrianNetworkLayer {
  private lines: PrimitiveCollection;
  private points: PointPrimitiveCollection;
  private previous?: PedestrianNetwork;
  constructor(private widget: CesiumWidget) {
    this.lines = widget.scene.primitives.add(new PrimitiveCollection());
    this.points = widget.scene.primitives.add(new PointPrimitiveCollection());
  }
  set(data?: PedestrianNetwork) {
    if (data === this.previous) return;
    this.previous = data;
    this.lines.removeAll();
    this.points.removeAll();
    const groups = new Map<string, GeometryInstance[]>();
    for (const segment of data?.segments ?? []) {
      const color =
        segment.enabled === false
          ? '#929b96'
          : data?.category === 'cover'
            ? { covered: '#547bb2', uncovered: '#b47a40', unknown: '#929b96' }[segment.cover]
            : '#7866a1';
      const instances = groups.get(color) ?? [];
      // Vertical lift edges collapse to a point in the ground projection. Keep them visible.
      if (segment.kind === 'Lift' || segment.kind === 'Stairlift') {
        const first = segment.paths[0][0];
        this.points.add({
          position: Cartesian3.fromDegrees(first[0], first[1], 2),
          pixelSize: 8,
          color: Color.fromCssColorString(color),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
      }
      for (const path of segment.paths)
        instances.push(
          new GeometryInstance({
            geometry: new PolylineGeometry({
              positions: path.map(([lng, lat]) => Cartesian3.fromDegrees(lng, lat, 2)),
              width: 3,
              arcType: ArcType.NONE,
              vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
            }),
          }),
        );
      groups.set(color, instances);
    }
    for (const [color, instances] of groups)
      this.lines.add(
        new Primitive({
          geometryInstances: instances,
          allowPicking: false,
          appearance: new PolylineMaterialAppearance({
            material: Material.fromType('Color', {
              color: Color.fromCssColorString(color).withAlpha(0.7),
            }),
          }),
        }),
      );
    this.widget.scene.primitives.raiseToTop(this.points);
    this.widget.scene.requestRender();
  }
  dispose() {
    this.widget.scene.primitives.remove(this.lines);
    this.widget.scene.primitives.remove(this.points);
  }
}
