import { BillboardCollection, Cartesian3, VerticalOrigin, type CesiumWidget } from 'cesium';
import type { SearchResult } from '@hk/contracts';
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><path d="M20 49C16 40 3 31 3 20a17 17 0 1 1 34 0c0 11-13 20-17 29Z" fill="#ee704f" stroke="white" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="white"/></svg>')}`;
export class SearchPin {
  private readonly markers: BillboardCollection;
  constructor(private widget: CesiumWidget) {
    this.markers = widget.scene.primitives.add(new BillboardCollection({ scene: widget.scene }));
    this.markers.add({
      id: 'search-pin',
      position: Cartesian3.ZERO,
      image,
      width: 36,
      height: 47,
      verticalOrigin: VerticalOrigin.BOTTOM,
      disableDepthTestDistance: Infinity,
      show: false,
    });
  }
  set(result: SearchResult | null) {
    const marker = this.markers.get(0);
    marker.show = Boolean(result?.location);
    if (result?.location)
      marker.position = Cartesian3.fromDegrees(result.location.lng, result.location.lat, 3);
    this.widget.scene.requestRender();
  }
  dispose() {
    this.widget.scene.primitives.remove(this.markers);
  }
}
