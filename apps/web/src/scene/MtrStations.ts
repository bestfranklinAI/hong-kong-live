import {
  Cartesian2,
  Cartesian3,
  Color,
  LabelCollection,
  LabelStyle,
  PointPrimitiveCollection,
  type CesiumWidget,
} from 'cesium';
import { mtrLines, mtrStations, mtrStationLocations, type StationSelection } from '@hk/contracts';

/** Only the active line is drawn. Selection updates reuse the existing primitives. */
export class MtrStations {
  private readonly points: PointPrimitiveCollection;
  private readonly labels: LabelCollection;
  private line?: string;
  private selectionKey?: string;
  constructor(private widget: CesiumWidget) {
    this.points = widget.scene.primitives.add(new PointPrimitiveCollection());
    this.labels = widget.scene.primitives.add(new LabelCollection({ scene: widget.scene }));
  }

  set(selection: StationSelection | null) {
    const key = selection ? `${selection.line}:${selection.station}` : undefined;
    if (key === this.selectionKey) return;
    this.selectionKey = key;
    this.points.show = this.labels.show = Boolean(selection);
    if (!selection) return;
    const line = mtrLines.find((line) => line.code === selection.line)!;
    if (this.line !== line.code) {
      this.line = line.code;
      this.points.removeAll();
      this.labels.removeAll();
      for (const code of line.stations) {
        const location = mtrStationLocations[code];
        if (!location) continue;
        const position = Cartesian3.fromDegrees(location.lng, location.lat, 8);
        this.points.add({
          id: `mtr-station:${code}`,
          position,
          pixelSize: 11,
          color: Color.fromCssColorString(line.color),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Infinity,
        });
      }
    }
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points.get(i);
      point.pixelSize = point.id === `mtr-station:${selection.station}` ? 20 : 11;
    }
    // One selected label avoids overlapping names on small screens.
    this.labels.removeAll();
    const location = mtrStationLocations[selection.station];
    if (location)
      this.labels.add({
        id: `mtr-station:${selection.station}`,
        position: Cartesian3.fromDegrees(location.lng, location.lat, 8),
        text: mtrStations[selection.station].name,
        font: '600 14px system-ui, sans-serif',
        fillColor: Color.fromCssColorString('#193d35'),
        outlineColor: Color.WHITE,
        outlineWidth: 4,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -25),
        disableDepthTestDistance: Infinity,
      });
    this.widget.scene.requestRender();
  }

  pick(id: string) {
    if (!this.points.show || !id.startsWith('mtr-station:')) return;
    const station = id.slice('mtr-station:'.length);
    const line = mtrLines.find((line) => line.code === this.line);
    if (line?.stations.includes(station)) return { line: line.code, station };
  }

  dispose() {
    this.widget.scene.primitives.remove(this.points);
    this.widget.scene.primitives.remove(this.labels);
  }
}
