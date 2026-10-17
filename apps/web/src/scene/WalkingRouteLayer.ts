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
import { routePaintRuns } from './route-paint-runs';
import type { StationRouteView, WalkingRoute } from '@hk/contracts';

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
  private previousHidden = false;
  private previousView?: StationRouteView;
  private sphere?: BoundingSphere;
  constructor(
    private widget: CesiumWidget,
    private frameTarget?: (
      centre: Cartesian3,
      pitch: number,
      range: number,
      duration: number,
      heading: number,
    ) => boolean,
  ) {
    this.lines = widget.scene.primitives.add(new PrimitiveCollection());
    this.points = widget.scene.primitives.add(new PointPrimitiveCollection());
  }
  set(
    route: WalkingRoute | null,
    sourceHeights = false,
    showHidden = false,
    frameOnChange = true,
    stationView?: StationRouteView,
  ) {
    if (
      route === this.previousRoute &&
      sourceHeights === this.previous3d &&
      showHidden === this.previousHidden &&
      stationView === this.previousView
    )
      return;
    const reframe = route !== this.previousRoute || sourceHeights !== this.previous3d;
    this.previousRoute = route;
    this.previous3d = sourceHeights;
    this.previousHidden = showHidden;
    this.previousView = stationView;
    this.lines.removeAll();
    this.points.removeAll();
    if (!route) this.sphere = undefined;
    if (route) {
      const all: Cartesian3[] = [];
      for (const { path, station } of routePaintRuns(route, sourceHeights, stationView)) {
        const positions = path.map(([lng, lat, z]) => Cartesian3.fromDegrees(lng, lat, z));
        all.push(...positions);
        this.lines.add(
          new Primitive({
            geometryInstances: new GeometryInstance({
              geometry: new PolylineGeometry({
                positions,
                width: station ? 3 : sourceHeights ? 9 : 7,
                arcType: ArcType.NONE,
                vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
              }),
            }),
            appearance: new PolylineMaterialAppearance({
              material: Material.fromType('PolylineOutline', {
                color: Color.fromCssColorString(station ? '#6b928b' : '#147d73').withAlpha(
                  station ? 0.5 : 1,
                ),
                outlineColor: Color.WHITE.withAlpha(station ? 0.4 : 1),
                outlineWidth: station ? 1 : 2,
              }),
            }),
            depthFailAppearance:
              sourceHeights && showHidden
                ? // Preserve route contrast through dense buildings without changing its heights.
                  new PolylineMaterialAppearance({
                    material: Material.fromType('PolylineOutline', {
                      color: Color.fromCssColorString(station ? '#6b928b' : '#008c7b').withAlpha(
                        station ? 0.4 : 1,
                      ),
                      outlineColor: Color.WHITE.withAlpha(station ? 0.3 : 1),
                      outlineWidth: station ? 1 : 2,
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
      this.sphere = all.length ? BoundingSphere.fromPoints(all) : undefined;
      if (reframe && frameOnChange) this.frame(true);
    }
    this.widget.scene.requestRender();
  }
  frame(animate = false) {
    const sphere = this.sphere;
    if (!sphere || !this.previousRoute) return;
    const pitch = this.previous3d ? -Math.PI / 3 : -Math.PI / 2;
    const aspect = Math.max(
      1,
      (this.widget.canvas?.clientHeight ?? 1) / Math.max(1, this.widget.canvas?.clientWidth ?? 1),
    );
    // Portrait views have a narrower horizontal FOV; a vertical-only fit clips route ends.
    const range = Math.max(350, sphere.radius * 4 * aspect);
    const start = this.previousRoute.paths[0][0];
    const end = this.previousRoute.paths.at(-1)!.at(-1)!;
    const heading = Math.atan2(
      (end[0] - start[0]) * Math.cos((start[1] * Math.PI) / 180),
      end[1] - start[1],
    );
    const duration = animate ? 0.7 : 0;
    if (this.frameTarget?.(sphere.center, pitch, range, duration, heading)) return;
    this.widget.camera.flyToBoundingSphere(sphere, {
      duration,
      offset: new HeadingPitchRange(heading, pitch, range),
    });
  }
  dispose() {
    this.widget.scene.primitives.remove(this.lines);
    this.widget.scene.primitives.remove(this.points);
  }
}
