import { Cartesian3, Color, Material, PolylineCollection, type CesiumWidget } from 'cesium';
import type { IndoorFloor, IndoorLayout } from '@hk/contracts';
/** Boundary inspection only: an outline is neither a walkable surface nor a route. */
export class IndoorFloorLayer {
  private lines: PolylineCollection;
  constructor(private widget: CesiumWidget) {
    this.lines = widget.scene.primitives.add(new PolylineCollection());
  }
  set(floor?: IndoorFloor, layout?: IndoorLayout) {
    this.lines.removeAll();
    const positions: Cartesian3[] = [];
    for (const polygon of floor?.polygons ?? [])
      for (const ring of polygon) {
        // Source Z is preserved in contracts, but not aligned to Cesium's ellipsoid.
        const boundary = ring.map(([lng, lat]) => Cartesian3.fromDegrees(lng, lat, 2));
        positions.push(...boundary);
        this.lines.add({
          positions: boundary,
          width: 4,
          material: Material.fromType('PolylineOutline', {
            color: Color.fromCssColorString('#765aa2'),
            outlineColor: Color.WHITE,
            outlineWidth: 1,
          }),
        });
      }
    for (const [kind, rows] of [
      ['units', layout?.units],
      ['openings', layout?.openings],
    ] as const) {
      const opening = kind === 'openings';
      for (const row of rows ?? []) {
        if (!floor || row.levelId !== floor.id || row.venueId !== floor.venueId) continue;
        for (const line of row.lines)
          this.lines.add({
            positions: line.map(([lng, lat]) =>
              Cartesian3.fromDegrees(lng, lat, opening ? 3.2 : 3),
            ),
            width: opening ? 4 : 2,
            material: Material.fromType('Color', {
              color: Color.fromCssColorString(opening ? '#087f8c' : '#536575'),
            }),
          });
      }
    }
    this.widget.scene.requestRender();
    return positions;
  }
  dispose() {
    this.widget.scene.primitives.remove(this.lines);
  }
}
