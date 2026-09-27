import { navigationPaths } from '../features/navigation/navigation-symbols';
import {
  BillboardCollection,
  SceneTransforms,
  type Cartesian2,
  Cartesian3,
  BoundingSphere,
  Cartographic,
  Math as CesiumMath,
  type CesiumWidget,
} from 'cesium';
import { IndoorFloorLayer } from './IndoorFloorLayer';
import type { IndoorFloor, IndoorPoint, IndoorLayout } from '@hk/contracts';
/** One explicitly chosen level, projected to the flat map; never infer floor from camera height. */
export class IndoorPoints {
  private floor: IndoorFloorLayer;
  private markers: BillboardCollection;
  private selectedId: string | undefined;
  private rows = new Map<string, IndoorPoint>();
  constructor(private widget: CesiumWidget) {
    this.floor = new IndoorFloorLayer(widget);
    this.markers = widget.scene.primitives.add(new BillboardCollection({ scene: widget.scene }));
  }
  set(points: IndoorPoint[] | undefined, floor?: IndoorFloor, layout?: IndoorLayout) {
    this.markers.removeAll();
    this.rows.clear();
    const positions: Cartesian3[] = this.floor.set(floor, layout);
    for (const p of points ?? []) {
      const id = `indoor-point:${p.id}`,
        position = Cartesian3.fromDegrees(p.lng, p.lat, 4);
      this.rows.set(id, p);
      positions.push(position);
      this.markers.add({
        id,
        position,
        width: 44,
        height: 44,
        disableDepthTestDistance: Infinity,
      });
    }
    this.select(this.selectedId);
    this.widget.scene.requestRender();
    if (!positions.length) return null;
    const sphere = BoundingSphere.fromPoints(positions);
    const centre = Cartographic.fromCartesian(sphere.center);
    return {
      lng: CesiumMath.toDegrees(centre.longitude),
      lat: CesiumMath.toDegrees(centre.latitude),
      range: Math.max(300, sphere.radius * 5),
    };
  }

  /** Match the visible 44 px target before GPU picking, which can hit overlapping geometry. */
  pickAt(position: Cartesian2) {
    let nearest: { point: IndoorPoint; distance: number } | undefined;
    for (let i = 0; i < this.markers.length; i++) {
      const marker = this.markers.get(i);
      const screen = SceneTransforms.worldToWindowCoordinates(this.widget.scene, marker.position);
      if (!screen) continue;
      const dx = Math.abs(screen.x - position.x),
        dy = Math.abs(screen.y - position.y);
      const radius = 22 * (marker.scale ?? 1);
      if (dx > radius || dy > radius) continue;
      const point = this.rows.get(String(marker.id));
      const distance = dx * dx + dy * dy;
      if (point && (!nearest || distance < nearest.distance)) nearest = { point, distance };
    }
    return nearest?.point;
  }
  select(id?: string) {
    this.selectedId = id;
    for (let i = 0; i < this.markers.length; i++) {
      const marker = this.markers.get(i);
      const selected = marker.id === `indoor-point:${id}`;
      marker.scale = selected ? 1.2 : 1;
      const point = this.rows.get(String(marker.id));
      const paths = navigationPaths[point?.category ?? 'entry'];
      const symbol = paths.map((d) => `<path d="${d}"/>`).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><circle cx="22" cy="22" r="20" fill="${selected ? '#087f8c' : '#765aa2'}" stroke="${selected ? '#ffdc83' : 'white'}" stroke-width="3"/><g transform="translate(9 8)" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${symbol}</g><circle cx="35" cy="35" r="8" fill="white"/><text x="35" y="39" text-anchor="middle" font-size="10" font-weight="700" font-family="sans-serif" fill="#173d3a">${i + 1}</text></svg>`;
      marker.image = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    this.widget.scene.requestRender();
  }

  pick(id: string) {
    return this.rows.get(id);
  }
  dispose() {
    this.floor.dispose();
    this.widget.scene.primitives.remove(this.markers);
    this.rows.clear();
  }
}
