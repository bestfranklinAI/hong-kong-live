import {
  BillboardCollection,
  BoundingSphere,
  Cartesian3,
  HeadingPitchRange,
  SceneTransforms,
  type CesiumWidget,
} from 'cesium';
import type { SearchResult, FacilityCategory } from '@hk/contracts';

const colours: Record<FacilityCategory, string> = {
  sports: '#a3642c',
  library: '#765aa2',
  refill: '#247eae',
};
const paths: Record<FacilityCategory, string> = {
  sports: '<path d="M12 12v16m5-13v10m6-10v10m5-13v16M17 20h6"/>',
  library: '<path d="M20 14c-4-3-8-3-11-2v16c4-1 7 0 11 2 4-2 7-3 11-2V12c-3-1-7-1-11 2v16"/>',
  refill: '<path d="M20 9c-3 5-9 10-9 15a9 9 0 0 0 18 0c0-5-6-10-9-15Z"/>',
};
function icon(category: FacilityCategory, count: number) {
  const content =
    count > 1
      ? `<text x="20" y="25" font-size="13" text-anchor="middle" fill="white" font-family="sans-serif">${count}</text>`
      : `<g fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[category]}</g>`;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="${colours[category]}" stroke="white" stroke-width="2"/>${content}</svg>`)}`;
}

/** Screen-grid clusters are rebuilt on settled camera moves, never through React frames. */
export class FacilityMarkers {
  private readonly markers: BillboardCollection;
  private rows: SearchResult[] = [];
  private groups = new Map<string, SearchResult[]>();
  private removeCameraListener: () => void;
  constructor(private widget: CesiumWidget) {
    this.markers = widget.scene.primitives.add(new BillboardCollection({ scene: widget.scene }));
    this.removeCameraListener = widget.camera.moveEnd.addEventListener(() => this.rebuild());
  }
  set(rows?: SearchResult[]) {
    this.rows = rows ?? [];
    this.rebuild();
  }
  private rebuild() {
    this.markers.removeAll();
    this.groups.clear();
    const { scene, canvas, camera } = this.widget;
    const grid = new Map<string, SearchResult[]>();
    for (const row of this.rows) {
      if (!row.location || !row.facility) continue;
      const screen = SceneTransforms.worldToWindowCoordinates(
        scene,
        Cartesian3.fromDegrees(row.location.lng, row.location.lat, 5),
      );
      if (
        !screen ||
        screen.x < 0 ||
        screen.y < 0 ||
        screen.x > canvas.clientWidth ||
        screen.y > canvas.clientHeight
      )
        continue;
      const key =
        camera.positionCartographic.height < 350
          ? row.id
          : `${row.facility.category}:${Math.floor(screen.x / 52)}:${Math.floor(screen.y / 52)}`;
      const group = grid.get(key) ?? [];
      group.push(row);
      grid.set(key, group);
    }
    for (const [key, group] of grid) {
      const row = group[0],
        id = `facility-marker:${key}`;
      this.groups.set(id, group);
      this.markers.add({
        id,
        position: Cartesian3.fromDegrees(row.location!.lng, row.location!.lat, 5),
        image: icon(row.facility!.category, group.length),
        width: 36,
        height: 36,
        disableDepthTestDistance: Infinity,
      });
    }
    scene.requestRender();
  }
  pick(id: string): SearchResult | undefined {
    const group = this.groups.get(id);
    if (!group) return;
    if (group.length === 1) return group[0];
    const sphere = BoundingSphere.fromPoints(
      group.map((row) => Cartesian3.fromDegrees(row.location!.lng, row.location!.lat, 5)),
    );
    this.widget.camera.flyToBoundingSphere(sphere, {
      duration: 0.6,
      offset: new HeadingPitchRange(
        this.widget.camera.heading,
        this.widget.camera.pitch,
        Math.max(200, sphere.radius * 3),
      ),
    });
  }
  dispose() {
    this.removeCameraListener();
    this.widget.scene.primitives.remove(this.markers);
    this.groups.clear();
    this.rows = [];
  }
}
