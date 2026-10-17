import { Cartesian3, SceneTransforms, Credit, type Cartesian2, type CesiumWidget } from 'cesium';
import { MapNameSource } from './MapNameSource';
import {
  mtrLines,
  mtrStations,
  mtrStationLocations,
  type Place,
  type StationSelection,
  type SearchResult,
  type MapNameLabel,
  type IndoorVenue,
  type StationRouteView,
} from '@hk/contracts';
import type { MapLanguage } from './basemaps';
import { layoutLabels, type LabelBox } from './label-layout';

type Row = {
  id: string;
  name: string;
  nameZh: string;
  lng: number;
  lat: number;
  category: string;
  station?: StationSelection;
  indoor?: IndoorVenue;
  routeStation?: string;
  exitName?: string;
  kind?: 'station' | 'building';
  place?: Place;
  target?: boolean;
  minimal?: boolean;
};
type Entry = { row: Row; element: HTMLElement; position: Cartesian3; width: number };
const icons: Record<string, string> = {
  indoor: '<path d="M4 21V4h16v17M9 21v-6h6v6M8 8h1m6 0h1M8 11h1m6 0h1M3 21h18"/>',
  target:
    '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  station:
    '<rect x="6" y="3" width="12" height="15" rx="4"/><path d="M8 21l2-3m6 3-2-3M6 10h12M9 14h.01M15 14h.01"/>',
  park: '<path d="M12 3l-6 8h3l-4 6h14l-4-6h3zM12 17v4"/>',
  waterfront: '<path d="M3 10c3-4 6 4 9 0s6 4 9 0M3 16c3-4 6 4 9 0s6 4 9 0"/>',
  culture: '<path d="M4 21V8l8-5 8 5v13M8 10v7m4-7v7m4-7v7M3 21h18"/>',
  landmark: '<path d="M5 21V9h5V3h5v9h4v9M9 21v-5h6v5"/>',
};

/** Screen annotations, not surveyed rooftop/floor positions. Layout stays outside React. */
export class MapLabels {
  private root = document.createElement('div');
  private entries: Entry[] = [];
  private visible: Array<{ entry: Entry; box: LabelBox }> = [];
  private places: Place[] = [];
  private indoorVenues: IndoorVenue[] = [];
  private routeStations: StationRouteView['stations'] = [];
  private target: SearchResult | null = null;
  private names: MapNameLabel[] = [];
  private namesSource: MapNameSource;
  private credit = new Credit('Map from Lands Department', true);
  private language: MapLanguage = 'en';
  private enabled = true;
  private compact = false;
  private lastLayout = -Infinity;
  private removeRender: () => void;
  private removeMove: () => void;
  constructor(
    private widget: CesiumWidget,
    private onPlace: (place: Place) => void,
    private onStation: (selection: StationSelection) => void,
    private insets: () => { top: number; bottom: number },
    private onTarget?: () => void,
    private onIndoor?: (venue: IndoorVenue) => void,
    private onRouteStation?: (id: string) => void,
  ) {
    this.root.className = 'map-context-labels';
    this.root.setAttribute('aria-label', 'Nearby places and stations');
    widget.container.append(this.root);
    this.removeRender = widget.scene.preRender.addEventListener(() => this.render());
    this.removeMove = widget.camera.moveEnd.addEventListener(() => {
      if (this.indoorVenues.length) this.rebuild();
      else this.invalidate();
      widget.scene.requestRender();
    });
    this.rebuild();
    widget.creditDisplay?.addStaticCredit(this.credit);
    this.namesSource = new MapNameSource(widget, (names) => {
      this.names = names;
      this.rebuild();
    });
  }
  setRouteStations(stations: StationRouteView['stations']) {
    if (stations === this.routeStations) return;
    this.routeStations = stations;
    this.rebuild();
  }
  setIndoorVenues(venues: IndoorVenue[]) {
    if (this.indoorVenues === venues) return;
    this.indoorVenues = venues;
    this.rebuild();
  }
  setPlaces(places: Place[]) {
    if (this.places === places) return;
    this.places = places;
    this.rebuild();
  }
  setLanguage(language: MapLanguage) {
    if (this.language === language) return;
    this.language = language;
    this.namesSource.setLanguage(language);
    this.rebuild();
  }
  setTarget(target: SearchResult | null) {
    if (this.target === target) return;
    this.target = target;
    this.rebuild();
  }
  setVisible(enabled: boolean) {
    this.namesSource.setVisible(enabled);
    this.enabled = enabled;
    this.root.hidden = !enabled;
    this.lastLayout = -Infinity;
  }
  invalidate() {
    this.lastLayout = -Infinity;
  }
  setCompact(compact: boolean) {
    if (this.compact === compact) return;
    this.compact = compact;
    this.namesSource.setTracking(compact);
    this.invalidate();
  }
  private rebuild() {
    const normalize = (name: string) => name.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
    const camera = this.widget.camera.positionCartographic;
    const lng = ((camera.longitude ?? (114.17 * Math.PI) / 180) * 180) / Math.PI;
    const lat = ((camera.latitude ?? (22.3 * Math.PI) / 180) * 180) / Math.PI;
    // Bound DOM work to nearby venue labels; this anchor is an envelope centre, not an entrance.
    const venues = this.indoorVenues
      .filter((venue) => venue.location)
      .map((venue) => ({
        venue,
        distance: (venue.location!.lng - lng) ** 2 + (venue.location!.lat - lat) ** 2,
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 120)
      .map((row) => row.venue);
    const indoorNames = new Set(
      venues.flatMap((venue) => [venue.name, venue.nameZh].filter(Boolean).map(normalize)),
    );
    const rows: Row[] = this.places
      .filter((place) => place.category !== 'station')
      .map((place) => ({
        id: place.id,
        name: place.name,
        nameZh: place.nameZh,
        lng: place.lng,
        lat: place.lat,
        category: place.category,
        place,
      }));
    for (const name of this.names) {
      if (name.kind === 'building' && indoorNames.has(normalize(name.text))) continue;
      rows.push({
        id: name.id,
        name: name.text,
        nameZh: name.text,
        lng: name.lng,
        lat: name.lat,
        category: name.kind,
        minimal: true,
      });
    }
    for (const venue of venues)
      rows.push({
        id: `indoor:${venue.id}`,
        name: venue.name,
        nameZh: venue.nameZh || venue.name,
        ...venue.location!,
        category: 'indoor',
        indoor: venue,
      });
    for (const [station, location] of Object.entries(mtrStationLocations)) {
      const line = mtrLines.find((line) => line.stations.includes(station));
      const name = mtrStations[station];
      if (line && name)
        rows.push({
          id: `context-station:${station}`,
          ...name,
          ...location,
          category: 'station',
          station: { line: line.code, station },
        });
    }
    for (const station of this.routeStations)
      rows.push({
        ...station,
        id: `route-station:${station.id}`,
        routeStation: station.id,
        category: 'station-section',
      });
    const targetPlace = this.places.find((place) => place.name === this.target?.name);
    const targetVenues = this.indoorVenues.filter((venue) =>
      [venue.name, venue.nameZh]
        .filter(Boolean)
        .some((name) =>
          [this.target?.name, this.target?.nameZh]
            .filter(Boolean)
            .some((target) => normalize(name) === normalize(target!)),
        ),
    );
    const targetVenue = targetVenues.length === 1 ? targetVenues[0] : undefined;
    if (this.target?.location)
      rows.push({
        id: 'context-target',
        name: this.target.name,
        nameZh: this.target.nameZh || targetPlace?.nameZh || this.target.name,
        ...this.target.location,
        category: this.target.station
          ? 'station'
          : targetVenue
            ? 'indoor'
            : (targetPlace?.category ?? 'target'),
        indoor: targetVenue,
        station:
          this.target.station ??
          (targetPlace?.station
            ? { line: targetPlace.station.line, station: targetPlace.station.code }
            : undefined),
        target: true,
      });
    this.root.replaceChildren();
    this.entries = rows.map((row) => {
      const element = row.minimal
        ? document.createElement('span')
        : document.createElement('button');
      if (element instanceof HTMLButtonElement) element.type = 'button';
      element.className = `map-context-label map-context-label--${row.category}${row.target ? ' map-context-label--target' : ''}${row.minimal ? ' map-context-label--minimal' : ''}`;
      const name = this.language === 'tc' ? row.nameZh : row.name;
      const displayName = row.exitName
        ? `${row.exitName} · ${name.replace(/\s+Station$/i, '').replace(/鐵路站$|站$/g, '')}`
        : row.routeStation
          ? `Through · ${name.replace(/\s+Station$/i, '').replace(/鐵路站$|站$/g, '')}`
          : row.indoor
            ? `Indoor · ${name}`
            : name;
      element.setAttribute(
        'aria-label',
        `${row.exitName ? 'Recommended route exit · ' + row.exitName + ' · ' : row.routeStation ? 'Station section · ' : row.station ? 'MTR · ' : row.indoor ? 'Indoor map · ' : ''}${name}`,
      );
      if (row.minimal) element.textContent = name;
      else {
        element.innerHTML = `<span class="map-context-label__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[row.routeStation ? (row.kind === 'building' ? 'indoor' : 'station') : row.category] ?? icons.landmark}</svg></span><span class="map-context-label__name"></span>`;
        element.querySelector('.map-context-label__name')!.textContent = displayName;
      }
      element.hidden = true;
      if (!row.minimal) element.onclick = () => this.select(row);
      this.root.append(element);
      // Bounded approximate width avoids DOM measurement during map animation.
      const width = Math.min(
        216,
        (row.minimal ? 12 : 60) +
          [...displayName].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 14 : 7), 0),
      );
      element.style.width = `${width}px`;
      return { row, element, width, position: Cartesian3.fromDegrees(row.lng, row.lat, 8) };
    });
    this.visible = [];
    this.lastLayout = -Infinity;
    this.widget.scene.requestRender();
  }
  private select(row: Row) {
    if (row.routeStation) this.onRouteStation?.(row.routeStation);
    else if (row.indoor) this.onIndoor?.(row.indoor);
    else if (row.station) this.onStation(row.station);
    else if (row.target) this.onTarget?.();
    else if (row.place) this.onPlace(row.place);
  }
  private render() {
    if (!this.enabled) return;
    const { scene, canvas, camera } = this.widget;
    const now = performance.now();
    const bounds = { width: canvas.clientWidth, height: canvas.clientHeight, ...this.insets() };
    if (now - this.lastLayout > 180) {
      this.lastLayout = now;
      this.entries.forEach((entry) => {
        entry.element.hidden = true;
      });
      const boxes: LabelBox[] = [];
      if (camera.positionCartographic.height < 24000)
        for (const entry of this.entries) {
          if (this.compact && !entry.row.minimal && !entry.row.routeStation) continue;
          if (entry.row.indoor && camera.positionCartographic.height > 6500) continue;
          if (entry.row.category === 'building' && camera.positionCartographic.height > 5000)
            continue;
          const screen = SceneTransforms.worldToWindowCoordinates(scene, entry.position);
          if (screen)
            boxes.push({
              id: entry.row.id,
              x: screen.x,
              y: screen.y - (entry.row.target ? 54 : 10),
              width: entry.width,
              height: entry.row.minimal ? 24 : 44,
              priority:
                entry.row.target || entry.row.routeStation
                  ? 4
                  : entry.row.station
                    ? 3
                    : entry.row.indoor
                      ? 2.5
                      : entry.row.minimal
                        ? entry.row.category === 'street'
                          ? 1.5
                          : 1
                        : 2,
              group: entry.row.category,
            });
        }
      const chosen = layoutLabels(
        boxes,
        bounds,
        this.compact ? 7 : canvas.clientWidth < 700 ? 12 : 20,
        {
          indoor: canvas.clientWidth < 700 ? 3 : 5,
          station: canvas.clientWidth < 700 ? 3 : 5,
          street: canvas.clientWidth < 700 ? 4 : 7,
          building: canvas.clientWidth < 700 ? 3 : 5,
        },
      );
      const byId = new Map(this.entries.map((entry) => [entry.row.id, entry]));
      this.visible = chosen.map((box) => ({ box, entry: byId.get(box.id)! }));
    }
    for (const item of this.visible) {
      const screen = SceneTransforms.worldToWindowCoordinates(scene, item.entry.position);
      const shown =
        screen && screen.y > bounds.top + 56 && screen.y < bounds.height - bounds.bottom;
      item.entry.element.hidden = !shown;
      if (!screen || !shown) continue;
      item.box.x = screen.x;
      item.box.y = screen.y - (item.entry.row.target ? 54 : 10);
      item.entry.element.style.transform = `translate3d(${item.box.x}px, ${item.box.y}px, 0) translate(-50%, -100%)`;
    }
  }
  /** Canvas hit testing preserves pinch/pan gestures even when they start on a chip. */
  pickAt(point: Cartesian2): boolean {
    if (!this.enabled) return false;
    const hit = this.visible.find(
      ({ box, entry }) =>
        !entry.element.hidden &&
        !entry.row.minimal &&
        Math.abs(point.x - box.x) <= box.width / 2 &&
        point.y >= box.y - box.height &&
        point.y <= box.y,
    );
    if (!hit) return false;
    this.select(hit.entry.row);
    return true;
  }
  dispose() {
    this.namesSource.dispose();
    this.widget.creditDisplay?.removeStaticCredit(this.credit);
    this.removeRender();
    this.removeMove();
    this.root.remove();
    this.entries = [];
    this.visible = [];
  }
}
