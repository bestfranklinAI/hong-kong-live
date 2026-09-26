import {
  BillboardCollection,
  Cartesian3,
  Color,
  Material,
  PolylineCollection,
  SceneTransforms,
  type CesiumWidget,
} from 'cesium';

export interface LocationFix {
  lng: number;
  lat: number;
  accuracy: number;
}
const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${body}</svg>`)}`;
const dot = svg(
  '<circle cx="64" cy="64" r="13" fill="#fff"/><circle cx="64" cy="64" r="9" fill="#2687ef"/>',
);
const cone = svg(
  '<defs><linearGradient id="a" x2="0" y2="1"><stop stop-color="#2687ef" stop-opacity="0"/><stop offset="1" stop-color="#2687ef" stop-opacity=".5"/></linearGradient></defs><path d="M64 64 25 6Q64 -8 103 6Z" fill="url(#a)"/>',
);

/** A local GPS fix and optional compass annotation; never persisted or sent to providers. */
export class UserLocation {
  private readonly markers: BillboardCollection;
  private readonly rings: PolylineCollection;
  private fix?: LocationFix;
  private heading?: number;
  private headingAt = 0;
  private readonly removeRender: () => void;
  private expiry?: ReturnType<typeof setTimeout>;
  private readonly orientation = (event: DeviceOrientationEvent) => {
    const compass = event as DeviceOrientationEvent & {
      webkitCompassHeading?: number;
      webkitCompassAccuracy?: number;
    };
    let heading: number | undefined;
    if (Number.isFinite(compass.webkitCompassHeading) && (compass.webkitCompassAccuracy ?? 0) >= 0)
      heading = compass.webkitCompassHeading;
    else if (event.absolute && event.alpha !== null && Number.isFinite(event.alpha))
      heading = 360 - event.alpha;
    if (heading === undefined) return;
    this.heading = (heading + (screen.orientation?.angle ?? 0) + 360) % 360;
    this.headingAt = Date.now();
    clearTimeout(this.expiry);
    this.expiry = setTimeout(() => {
      this.heading = undefined;
      this.widget.scene.requestRender();
    }, 10000);
    this.widget.scene.requestRender();
  };
  constructor(private readonly widget: CesiumWidget) {
    this.markers = widget.scene.primitives.add(new BillboardCollection({ scene: widget.scene }));
    this.rings = widget.scene.primitives.add(new PolylineCollection());
    for (const image of [cone, dot])
      this.markers.add({
        position: Cartesian3.ZERO,
        image,
        width: 96,
        height: 96,
        show: false,
        disableDepthTestDistance: Infinity,
      });
    this.removeRender = widget.scene.preRender.addEventListener(() => this.render());
  }
  set(fix: LocationFix) {
    this.fix = fix;
    this.rings.removeAll();
    const radius = Math.max(0, fix.accuracy);
    if (Number.isFinite(radius) && radius > 0)
      this.rings.add({
        positions: Array.from({ length: 65 }, (_, i) => this.offset((i * 360) / 64, radius)),
        width: 2,
        material: Material.fromType('Color', {
          color: Color.fromCssColorString('#2687ef').withAlpha(0.45),
        }),
      });
    window.addEventListener('deviceorientationabsolute', this.orientation as EventListener);
    window.addEventListener('deviceorientation', this.orientation);
    this.widget.scene.requestRender();
  }
  private offset(heading: number, metres: number) {
    const fix = this.fix!;
    const angle = (heading * Math.PI) / 180;
    return Cartesian3.fromDegrees(
      fix.lng +
        (Math.sin(angle) * metres) / (111195 * Math.max(0.01, Math.cos((fix.lat * Math.PI) / 180))),
      fix.lat + (Math.cos(angle) * metres) / 111195,
      3,
    );
  }
  private render() {
    if (!this.fix) return;
    const position = this.offset(0, 0);
    const dotMarker = this.markers.get(1),
      coneMarker = this.markers.get(0);
    dotMarker.position = position;
    dotMarker.show = true;
    coneMarker.position = position;
    coneMarker.show = this.heading !== undefined && Date.now() - this.headingAt < 10000;
    if (coneMarker.show) {
      const a = SceneTransforms.worldToWindowCoordinates(this.widget.scene, position);
      const b = SceneTransforms.worldToWindowCoordinates(
        this.widget.scene,
        this.offset(this.heading!, 100),
      );
      if (a && b) coneMarker.rotation = Math.atan2(a.x - b.x, a.y - b.y);
      else coneMarker.show = false;
    }
  }
  dispose() {
    clearTimeout(this.expiry);
    window.removeEventListener('deviceorientationabsolute', this.orientation as EventListener);
    window.removeEventListener('deviceorientation', this.orientation);
    this.removeRender();
    this.widget.scene.primitives.remove(this.markers);
    this.widget.scene.primitives.remove(this.rings);
  }
}
