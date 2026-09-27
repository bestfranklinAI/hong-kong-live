import {
  PrimitiveCollection,
  Primitive,
  GeometryInstance,
  PolylineGeometry,
  PolylineMaterialAppearance,
  ArcType,
  Material,
  Color,
  Cartesian3,
  BoundingSphere,
  HeadingPitchRange,
  PointPrimitiveCollection,
  type CesiumWidget,
} from 'cesium';
import type { WalkingRoute } from '@hk/contracts';

/** Split at unknown heights; never bridge a gap with an invented elevation. */
export function routeDisplayPaths(route: WalkingRoute, sourceHeights: boolean) {
  const paths: number[][][] = [];
  for (const path of route.paths) {
    let run: number[][] = [];
    const flush = () => {
      if (run.length > 1) paths.push(run);
      run = [];
    };
    for (const [lng, lat, z] of path) {
      if (sourceHeights && z === null) flush();
      else run.push([lng, lat, sourceHeights ? z! : 3]);
    }
    flush();
  }
  return paths;
}

export class WalkingRouteLayer {
  private lines: PrimitiveCollection;
  private points: PointPrimitiveCollection;
  private previousRoute: WalkingRoute | null = null;
  private previous3d = false;
  constructor(private widget: CesiumWidget) {
    this.lines = widget.scene.primitives.add(new PrimitiveCollection());
    this.points = widget.scene.primitives.add(new PointPrimitiveCollection());
  }
  set(route: WalkingRoute | null, sourceHeights = false, showHidden = false) {
    const reframe = route !== this.previousRoute || sourceHeights !== this.previous3d;
    this.previousRoute = route;
    this.previous3d = sourceHeights;
    this.lines.removeAll();
    this.points.removeAll();
    if (route) {
      const all: Cartesian3[] = [];
      for (const path of routeDisplayPaths(route, sourceHeights)) {
        const positions = path.map(([lng, lat, z]) => Cartesian3.fromDegrees(lng, lat, z));
        all.push(...positions);
        this.lines.add(
          new Primitive({
            geometryInstances: new GeometryInstance({
              geometry: new PolylineGeometry({
                positions,
                width: sourceHeights ? 4 : 7,
                arcType: ArcType.NONE,
                vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
              }),
            }),
            appearance: new PolylineMaterialAppearance({
              material: Material.fromType('PolylineOutline', {
                color: Color.fromCssColorString('#147d73'),
                outlineColor: Color.WHITE,
                outlineWidth: 1,
              }),
            }),
            depthFailAppearance:
              sourceHeights && showHidden
                ? new PolylineMaterialAppearance({
                    material: Material.fromType('PolylineDash', {
                      color: Color.fromCssColorString('#73aaa4').withAlpha(0.65),
                      dashLength: 16,
                    }),
                  })
                : undefined,
            asynchronous: false,
          }),
        );
      }
      // Mark actual route endpoints, not the ends of runs split by unknown heights.
      for (const [i, point] of [route.paths[0][0], route.paths.at(-1)!.at(-1)!].entries()) {
        const [lng, lat, z] = point;
        if (sourceHeights && z === null) continue;
        this.points.add({
          position: Cartesian3.fromDegrees(lng, lat, sourceHeights ? z! : 3),
          pixelSize: 14,
          color: Color.fromCssColorString(i ? '#ee704f' : '#147d73'),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: !sourceHeights || showHidden ? Infinity : 0,
        });
      }
      if (all.length && reframe) {
        const sphere = BoundingSphere.fromPoints(all);
        this.widget.camera.flyToBoundingSphere(sphere, {
          duration: 0.7,
          offset: new HeadingPitchRange(
            0,
            sourceHeights ? -Math.PI / 3 : -Math.PI / 2,
            Math.max(500, sphere.radius * 4),
          ),
        });
      }
    }
    this.widget.scene.requestRender();
  }
  dispose() {
    this.widget.scene.primitives.remove(this.lines);
    this.widget.scene.primitives.remove(this.points);
  }
}
