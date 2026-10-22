import { NavigationCamera } from './NavigationCamera';
import { MapLabels } from './MapLabels';
import { CityLayers, type CityPresentation, type CitySources } from './CityLayers';
import { installFlatMapRotation } from './FlatMapRotation';
import { IndoorPoints } from './IndoorPoints';
import { WalkingRouteLayer } from './WalkingRouteLayer';
import { PedestrianNetworkLayer } from './PedestrianNetworkLayer';
import { SearchPin } from './SearchPin';
import { FacilityMarkers } from './FacilityMarkers';
import type { SearchResult } from '@hk/contracts';
import { UserLocation, type LocationFix } from './UserLocation';
import { TrainMotion } from './TrainMotion';
import { BusStops } from './BusStops';
import type { BusStop } from '@hk/contracts';
import { MtrStations } from './MtrStations';
import { mtrStationLocations, type StationSelection } from '@hk/contracts';
import { TrafficCameras } from './TrafficCameras';
import type { TrafficCamera } from '@hk/contracts';
import { RainfallLayer, type RainfallSelection } from './RainfallLayer';
import { BasemapLayers } from './BasemapLayers';
import { ScenePerformance } from './ScenePerformance';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  CesiumWidget,
  Color,
  EllipsoidTerrainProvider,
  HeadingPitchRange,
  Math as CesiumMath,
  Matrix4,
  NearFarScalar,
  PerspectiveFrustum,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  SceneTransforms,
  Transforms,
  type PointPrimitive,
} from 'cesium';
import {
  basemapLayerDefinitions,
  basemapNames,
  type SceneBasemap,
  type MapLanguage,
} from './basemaps';
import type { Place, Quality, ViewMode } from '@hk/contracts';
import type { SceneCommand, SceneDiagnostics, SceneInspector, SceneStatus } from './types';

const HARBOUR = { lng: 114.1694, lat: 22.2912 };
const INITIAL_RANGE = 6_800;
const WEATHER_RANGE = 85_000;
const COLOURS = {
  marker: Color.fromCssColorString('#147d73'),
  selected: Color.fromCssColorString('#fa704d'),
  water: Color.fromCssColorString('#b9d6db'),
};

const QUALITY = {
  efficient: {
    resolution: 1,
    screenSpaceError: 32,
    cacheBytes: 64 * 1024 ** 2,
    globeError: 4,
    globeCacheTiles: 128,
    msaa: 1,
  },
  balanced: {
    resolution: 1,
    screenSpaceError: 20,
    cacheBytes: 192 * 1024 ** 2,
    globeError: 2.5,
    globeCacheTiles: 256,
    msaa: 2,
  },
  detailed: {
    resolution: 1.75,
    screenSpaceError: 12,
    cacheBytes: 320 * 1024 ** 2,
    globeError: 1.5,
    globeCacheTiles: 384,
    msaa: 4,
  },
} satisfies Record<Quality, object>;

interface Marker {
  place: Place;
  point: PointPrimitive;
}

interface SceneOptions {
  onIndoorPointSelect?: (point: import('@hk/contracts').IndoorPoint) => void;
  onFacilitySelect?: (row: SearchResult) => void;
  onSearchPinSelect?: () => void;
  onRotationChange?: (rotated: boolean) => void;
  onTrainSelect?: (arrival: import('../features/trains/motion').TrainApproach) => void;
  onRoutePoint?: (point: { lat: number; lng: number } | null) => void;
  onBusAreaSelect?: (area: { lng: number; lat: number } | null) => void;
  onSelect: (place: Place) => void;
  onCameraSelect?: (camera: TrafficCamera) => void;
  onBusStopSelect?: (stop: BusStop) => void;
  onRouteStationSelect?: (id: string) => void;
  onIndoorVenueSelect?: (venue: import('@hk/contracts').IndoorVenue) => void;
  onStationSelect?: (selection: StationSelection) => void;
  onStatus: (status: SceneStatus) => void;
  creditContainer: HTMLElement;
  performanceOutput?: HTMLElement;
  measurePerformance?: boolean;
  cityPresentation?: 'photo' | 'buildings';
  tilesetUrl?: string;
  citySources?: CitySources;
  onFollowChange?: (following: boolean) => void;
  basemap: SceneBasemap;
  mapLanguage: MapLanguage;
}

/** Owns every mutable engine object; React sends infrequent semantic commands only. */
export class SceneController {
  private readonly facilities: FacilityMarkers;
  private readonly indoorPoints: IndoorPoints;
  private readonly walkingRoute: WalkingRouteLayer;
  private readonly pedestrianNetwork: PedestrianNetworkLayer;
  private readonly searchPin: SearchPin;
  private readonly userLocation: UserLocation;
  private readonly trafficCameras: TrafficCameras;
  private readonly mtr: MtrStations;
  private readonly trainMotion: TrainMotion;
  private readonly busStops: BusStops;
  private busTarget: BusStop | null = null;
  private stationCode?: string;
  private indoorTarget: { lng: number; lat: number; range: number } | null = null;
  private searchTarget: { lng: number; lat: number } | null = null;
  private stationTarget: { lng: number; lat: number } | null = null;
  private cameraId: string | undefined;
  private trafficTarget: TrafficCamera | null = null;
  private readonly rainfall: RainfallLayer;
  private readonly widget: CesiumWidget;
  private readonly points: PointPrimitiveCollection;
  private readonly contextLabels: MapLabels;
  private readonly events: ScreenSpaceEventHandler;
  private readonly cleanups: Array<() => void> = [];
  private readonly markers = new Map<string, Marker>();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly inspector: SceneInspector;
  private readonly city: CityLayers;
  private navigation: NavigationCamera;
  private navigating = false;
  private planning = false;
  private hasWalkingRoute = false;
  private mode: ViewMode = 'explore';
  private quality: Quality = 'balanced';
  private selected: Place | null = null;
  private pitched = true;
  private cityView = false;
  private disposed = false;
  private renderedFrames = 0;
  private pendingGlobeTiles = 0;
  private readonly basemapLayers: BasemapLayers;
  private basemap: SceneBasemap = 'none';
  private mapLanguage: MapLanguage = 'en';
  private viewportInsets = { top: 0, bottom: 0 };
  private viewportSize = { width: 0, height: 0 };

  constructor(
    container: HTMLElement,
    private readonly options: SceneOptions,
  ) {
    this.widget = new CesiumWidget(container, {
      // Never allow Cesium's default ion imagery or terrain to request an implicit token.
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      creditContainer: options.creditContainer,
      requestRenderMode: true,
      maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      useBrowserRecommendedResolution: true,
      scene3DOnly: true,
      skyBox: false,
      skyAtmosphere: false,
      shadows: false,
      msaaSamples: 1,
      showRenderLoopErrors: false,
      contextOptions: { webgl: { alpha: false, antialias: false } },
    });

    this.city = new CityLayers(
      this.widget,
      options.citySources ?? { [options.cityPresentation ?? 'photo']: options.tilesetUrl },
      options.cityPresentation ?? 'photo',
      QUALITY[this.quality],
      () => this.reportStatus(),
    );
    this.cleanups.push(() => this.city.dispose());
    this.searchPin = new SearchPin(this.widget);
    this.pedestrianNetwork = new PedestrianNetworkLayer(this.widget);
    this.walkingRoute = new WalkingRouteLayer(
      this.widget,
      (centre, pitch, range, duration, heading) =>
        this.flyToFramedTarget(centre, pitch, range, duration, heading),
    );
    this.indoorPoints = new IndoorPoints(this.widget);
    this.facilities = new FacilityMarkers(this.widget);
    this.userLocation = new UserLocation(this.widget);
    this.navigation = new NavigationCamera(
      this.widget,
      this.userLocation,
      options.onFollowChange,
      () => this.viewportInsets,
      () => this.cityView,
    );
    this.trafficCameras = new TrafficCameras(this.widget);
    this.mtr = new MtrStations(this.widget);
    this.trainMotion = new TrainMotion(this.widget);
    this.busStops = new BusStops(this.widget);
    this.rainfall = new RainfallLayer(this.widget);
    this.basemapLayers = new BasemapLayers(this.widget.imageryLayers, () => this.reportStatus());
    if (
      (import.meta.env.VITE_SCENE_DIAGNOSTICS === 'true' || options.measurePerformance) &&
      options.performanceOutput
    ) {
      const measurements = new ScenePerformance(this.widget, options.performanceOutput, () =>
        this.city.snapshot(),
      );
      this.cleanups.push(() => measurements.dispose());
    }
    this.cleanups.push(
      installFlatMapRotation(this.widget, () => !this.cityView || this.mode === 'weather'),
    );
    const { scene } = this.widget;
    this.cleanups.push(
      scene.renderError.addEventListener((_scene, error) => {
        console.error(`Map rendering error: ${String(error)}`);
        this.options.onStatus?.({
          ready: false,
          message: 'The map renderer paused. Reload the page to restore the map.',
        });
      }),
    );
    scene.backgroundColor = COLOURS.water;
    scene.globe.baseColor = COLOURS.water;
    scene.globe.enableLighting = false;
    scene.globe.depthTestAgainstTerrain = false;
    scene.fog.enabled = false;
    scene.screenSpaceCameraController.minimumZoomDistance = 180;
    scene.screenSpaceCameraController.maximumZoomDistance = 120_000;
    this.widget.canvas.setAttribute(
      'aria-label',
      'Interactive Hong Kong map. Use the place list and map controls as a keyboard alternative.',
    );

    this.points = scene.primitives.add(new PointPrimitiveCollection());
    this.contextLabels = new MapLabels(
      this.widget,
      (place) => this.options.onSelect(place),
      (station) => this.options.onStationSelect?.(station),
      () => this.viewportInsets,
      () => this.options.onSearchPinSelect?.(),
      (venue) => this.options.onIndoorVenueSelect?.(venue),
      (id) => this.options.onRouteStationSelect?.(id),
    );
    this.events = new ScreenSpaceEventHandler(this.widget.canvas);
    this.events.setInputAction(
      () => this.command('zoom-in'),
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    this.events.setInputAction((event: { position: Cartesian2 }) => {
      if (this.contextLabels.pickAt(event.position)) return;
      const indoorPoint = this.indoorPoints.pickAt(event.position);
      if (indoorPoint) {
        this.options.onIndoorPointSelect?.(indoorPoint);
        return;
      }
      const picked: unknown = scene.pick(event.position, 12, 12);
      if (typeof picked !== 'object' || picked === null || !('id' in picked)) return;
      if (String(picked.id).startsWith('indoor-point:')) {
        const point = this.indoorPoints.pick(String(picked.id));
        if (point) this.options.onIndoorPointSelect?.(point);
        return;
      }
      if (picked.id === 'search-pin') {
        this.options.onSearchPinSelect?.();
        return;
      }
      if (String(picked.id).startsWith('facility-marker:')) {
        const row = this.facilities.pick(String(picked.id));
        if (row) this.options.onFacilitySelect?.(row);
        return;
      }
      if (String(picked.id).startsWith('traffic-camera:')) {
        const camera = this.trafficCameras.pick(String(picked.id));
        if (camera) this.options.onCameraSelect?.(camera);
        return;
      }
      if (String(picked.id).startsWith('bus-stop:')) {
        const stop = this.busStops.pick(String(picked.id));
        if (stop) this.options.onBusStopSelect?.(stop);
        return;
      }
      if (String(picked.id).startsWith('train-approach:')) {
        const arrival = this.trainMotion.pick(String(picked.id));
        if (arrival) this.options.onTrainSelect?.(arrival);
        return;
      }
      if (String(picked.id).startsWith('mtr-station:')) {
        const selection = this.mtr.pick(String(picked.id));
        if (selection) this.options.onStationSelect?.(selection);
        return;
      }
      const marker = this.markers.get(String(picked.id));
      if (marker) this.options.onSelect(marker.place);
    }, ScreenSpaceEventType.LEFT_CLICK);

    this.cleanups.push(
      scene.postRender.addEventListener(() => {
        this.renderedFrames += 1;
      }),
    );
    this.cleanups.push(
      scene.globe.tileLoadProgressEvent.addEventListener((remaining: number) => {
        this.pendingGlobeTiles = remaining;
      }),
    );
    this.cleanups.push(
      scene.renderError.addEventListener(() => {
        this.options.onStatus({
          ready: false,
          message: 'Map rendering stopped. Reload to retry; the place list is still available.',
        });
      }),
    );
    const onContextLost = () =>
      this.options.onStatus({
        ready: false,
        message: 'Graphics connection lost. Reload to reconnect the map.',
      });
    this.widget.canvas.addEventListener('webglcontextlost', onContextLost);
    this.cleanups.push(() =>
      this.widget.canvas.removeEventListener('webglcontextlost', onContextLost),
    );

    this.widget.camera.lookAt(
      Cartesian3.fromDegrees(HARBOUR.lng, HARBOUR.lat),
      new HeadingPitchRange(0, CesiumMath.toRadians(-55), INITIAL_RANGE),
    );
    this.widget.camera.lookAtTransform(Matrix4.IDENTITY);
    this.setBasemap(options.basemap, options.mapLanguage);
    this.setQuality('balanced');
    this.reportStatus();

    this.cleanups.push(
      this.widget.camera.moveEnd.addEventListener(() => {
        const heading = CesiumMath.toDegrees(this.widget.camera.heading);
        this.options.onRotationChange?.(heading > 2 && heading < 358);
      }),
    );
    this.inspector = { snapshot: () => this.snapshot(), command: (type) => this.command(type) };
    if (import.meta.env.DEV) window.__HK_SCENE__ = this.inspector;
  }

  setBasemap(basemap: SceneBasemap, language: MapLanguage): void {
    if (this.disposed || (this.basemap === basemap && this.mapLanguage === language)) return;
    this.basemap = basemap;
    this.mapLanguage = language;
    this.contextLabels.setLanguage(language);
    this.basemapLayers.update(basemapLayerDefinitions(basemap, language));
    this.reportStatus();
    this.widget.scene.requestRender();
  }

  setPlaces(places: Place[]): void {
    if (this.disposed) return;
    this.points.removeAll();
    this.markers.clear();
    for (const place of places) {
      const position = Cartesian3.fromDegrees(place.lng, place.lat, 8);
      const point = this.points.add({
        id: place.id,
        position,
        pixelSize: 12,
        color: COLOURS.marker,
        outlineColor: Color.WHITE,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(500, 1.25, 20_000, 0.7),
      });
      this.markers.set(place.id, { place, point });
    }
    this.updateMarkerSelection();
    this.widget.scene.requestRender();
  }

  setIndoorVenues(venues: import('@hk/contracts').IndoorVenue[]): void {
    this.contextLabels.setIndoorVenues(venues);
  }
  setContextPlaces(places: Place[]): void {
    this.contextLabels.setPlaces(places);
  }

  selectPlace(place: Place | null): void {
    if (this.disposed || this.selected?.id === place?.id) return;
    this.selected = place;
    this.updateMarkerSelection();
    if (place && this.mode === 'explore') this.focus(place.lng, place.lat, 1_700);
    this.widget.scene.requestRender();
  }

  setTrafficCameras(cameras: TrafficCamera[] | undefined, selected: TrafficCamera | null): void {
    if (this.disposed) return;
    this.trafficTarget = selected;
    this.trafficCameras.set(cameras, selected?.id);
    this.points.show = this.mode === 'explore';
    if (selected && selected.id !== this.cameraId) this.focus(selected.lng, selected.lat, 3500);
    this.cameraId = selected?.id;
  }

  setBusStops(stops: BusStop[] | undefined, selected: BusStop | null): void {
    if (this.disposed) return;
    this.busStops.set(stops, selected);
    if (selected && (selected.id !== this.busTarget?.id || selected.seq !== this.busTarget?.seq))
      this.focus(selected.lng, selected.lat, 2000);
    this.busTarget = selected;
  }

  setMtrStation(selection: StationSelection | null): void {
    if (this.disposed) return;
    this.mtr.set(selection);
    this.stationTarget = selection ? (mtrStationLocations[selection.station] ?? null) : null;
    if (this.stationTarget && selection?.station !== this.stationCode)
      this.focus(this.stationTarget.lng, this.stationTarget.lat, 3500);
    this.stationCode = selection?.station;
    this.widget.scene.requestRender();
  }

  setRainfall(selection: RainfallSelection | null): void {
    if (!this.disposed) this.rainfall.set(selection);
  }

  setMode(mode: ViewMode): void {
    if (this.disposed || mode === this.mode) return;
    this.mode = mode;
    this.points.show = mode === 'explore';
    this.contextLabels.setVisible(mode !== 'weather');
    this.contextLabels.setCompact(mode !== 'explore' || this.navigating);
    // Globe imagery is hidden by opaque city meshes; weather gets a clear top-down surface.
    this.city.setActive(this.cityView && mode !== 'weather');
    this.updateCityBasemap();
    this.widget.scene.screenSpaceCameraController.enableTilt = this.cityView && mode !== 'weather';
    this.reportStatus();
    const centre = this.selected ?? HARBOUR;
    this.focus(
      centre.lng,
      centre.lat,
      mode === 'weather' ? WEATHER_RANGE : this.selected ? 1_700 : INITIAL_RANGE,
    );
    this.widget.scene.requestRender();
  }

  setTrainMotion(input: import('../features/trains/motion').TrainMotionInput | null) {
    this.trainMotion.set(input);
  }

  setQuality(quality: Quality): void {
    this.trainMotion.setQuality(quality);
    if (this.disposed) return;
    this.quality = quality;
    const preset = QUALITY[quality];
    this.widget.resolutionScale = Math.min(preset.resolution, window.devicePixelRatio || 1);
    this.widget.scene.msaaSamples = preset.msaa;
    this.widget.scene.globe.maximumScreenSpaceError = preset.globeError;
    // A tile-count retention target, not a byte limit; current visible tiles may exceed it.
    this.widget.scene.globe.tileCacheSize = preset.globeCacheTiles;
    this.city.setQuality(preset);
    this.widget.scene.requestRender();
  }

  setViewportInsets(insets: { top: number; bottom: number }): void {
    if (this.disposed) return;
    const height = this.widget.canvas.clientHeight;
    const width = this.widget.canvas.clientWidth;
    // Always retain a usable viewing strip even on short screens or large text settings.
    const top = Math.max(0, Math.min(insets.top, height - 150));
    const bottom = Math.max(0, Math.min(insets.bottom, height - top - 100));
    if (
      Math.abs(top - this.viewportInsets.top) < 1 &&
      Math.abs(bottom - this.viewportInsets.bottom) < 1 &&
      width === this.viewportSize.width &&
      height === this.viewportSize.height
    )
      return;
    this.viewportInsets = { top, bottom };
    this.contextLabels.invalidate();
    this.viewportSize = { width, height };
    this.widget.resize();
    if (this.navigating) {
      this.widget.scene.requestRender();
      return;
    }
    if (this.hasWalkingRoute) this.walkingRoute.frame();
    else if (this.indoorTarget)
      this.focus(this.indoorTarget.lng, this.indoorTarget.lat, this.indoorTarget.range, false);
    else if (this.searchTarget)
      this.focus(this.searchTarget.lng, this.searchTarget.lat, 1400, false);
    else if (this.trafficTarget)
      this.focus(this.trafficTarget.lng, this.trafficTarget.lat, 3500, false);
    else if (this.busTarget) this.focus(this.busTarget.lng, this.busTarget.lat, 2000, false);
    else if (this.stationTarget)
      this.focus(this.stationTarget.lng, this.stationTarget.lat, 3500, false);
    else if (this.selected)
      this.focus(
        this.selected.lng,
        this.selected.lat,
        this.mode === 'weather' ? WEATHER_RANGE : 1_700,
        false,
      );
    this.widget.scene.requestRender();
  }

  setSearchPin(result: SearchResult | null) {
    this.searchTarget = result?.location ?? null;
    this.searchPin.set(result);
    this.contextLabels.setTarget(result);
    if (result?.location) this.focus(result.location.lng, result.location.lat, 1400);
  }
  setIndoorPoints(
    points?: import('@hk/contracts').IndoorPoint[],
    floor?: import('@hk/contracts').IndoorFloor,
    layout?: import('@hk/contracts').IndoorLayout,
  ) {
    this.indoorTarget = this.indoorPoints.set(points, floor, layout);
    if (this.indoorTarget)
      this.focus(this.indoorTarget.lng, this.indoorTarget.lat, this.indoorTarget.range);
  }
  selectIndoorPoint(id?: string) {
    this.indoorPoints.select(id);
  }
  setWalkingRoute(
    route: import('@hk/contracts').WalkingRoute | null,
    sourceHeights = false,
    showHidden = false,
    stationView?: import('@hk/contracts').StationRouteView,
    completedM = 0,
  ) {
    this.contextLabels.setRouteStations(stationView?.stations ?? []);
    this.hasWalkingRoute = Boolean(route);
    // Recalculation must not replace the walking camera with a route overview.
    this.walkingRoute.set(
      route,
      sourceHeights,
      showHidden,
      !this.navigating,
      stationView,
      completedM,
    );
  }
  setPedestrianNetwork(data?: import('@hk/contracts').PedestrianNetwork) {
    this.pedestrianNetwork.set(data);
  }
  setFacilities(rows?: SearchResult[]) {
    this.facilities.set(rows);
  }

  setNavigation(state?: import('./types').MapSceneProps['navigation']) {
    const enteringPlanner = !this.planning && Boolean(state?.planning);
    this.planning = state?.planning ?? false;
    // Fetch the root manifest during destination entry, without traversing city tiles in 2D.
    if (enteringPlanner) this.requestCity();
    this.navigating = state?.active ?? false;
    this.contextLabels.setVisible(this.mode !== 'weather');
    this.contextLabels.setCompact(this.mode !== 'explore' || this.navigating);
    this.navigation.set(this.navigating, state?.following ?? true, state?.fix ?? null, state?.z);
    this.city.setNavigating(this.navigating);
  }

  locate(location: LocationFix): void {
    if (!this.disposed && Number.isFinite(location.lng) && Number.isFinite(location.lat)) {
      this.userLocation.set(location);
      this.focus(location.lng, location.lat, 1800);
    }
  }

  command(type: SceneCommand['type']): void {
    if (this.disposed) return;
    if (
      type === 'zoom-in' ||
      type === 'zoom-out' ||
      type === 'reset' ||
      type === 'north' ||
      type === 'toggle-pitch'
    )
      this.navigation.pause();
    const { camera, scene } = this.widget;
    camera.cancelFlight();
    switch (type) {
      case 'route-overview':
        this.walkingRoute.frame(true);
        break;
      case 'retry-city':
        this.city.retry();
        break;
      case 'pick-route-point': {
        const canvas = this.widget.canvas;
        const point = camera.pickEllipsoid(
          new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
          scene.globe.ellipsoid,
        );
        const location = point ? Cartographic.fromCartesian(point) : null;
        this.options.onRoutePoint?.(
          location
            ? {
                lng: CesiumMath.toDegrees(location.longitude),
                lat: CesiumMath.toDegrees(location.latitude),
              }
            : null,
        );
        break;
      }
      case 'search-bus-area': {
        const canvas = this.widget.canvas;
        // On phones, use the visible map strip above the expanded panel.
        const y = (this.viewportInsets.top + canvas.clientHeight - this.viewportInsets.bottom) / 2;
        const point = camera.pickEllipsoid(
          new Cartesian2(canvas.clientWidth / 2, y),
          scene.globe.ellipsoid,
        );
        const location = point ? Cartographic.fromCartesian(point) : null;
        this.options.onBusAreaSelect?.(
          location
            ? {
                lng: CesiumMath.toDegrees(location.longitude),
                lat: CesiumMath.toDegrees(location.latitude),
              }
            : null,
        );
        break;
      }
      case 'zoom-in':
        camera.zoomIn(
          Math.max(
            0,
            Math.min(
              camera.positionCartographic.height - 180,
              camera.positionCartographic.height * 0.35,
            ),
          ),
        );
        break;
      case 'zoom-out':
        camera.zoomOut(
          Math.max(
            0,
            Math.min(
              120_000 - camera.positionCartographic.height,
              camera.positionCartographic.height * 0.5,
            ),
          ),
        );
        break;
      case 'reset':
        this.focus(
          HARBOUR.lng,
          HARBOUR.lat,
          this.mode === 'weather' ? WEATHER_RANGE : INITIAL_RANGE,
        );
        break;
      case 'north':
        this.reorient(camera.pitch);
        break;
      case 'toggle-pitch': {
        if (!this.cityView) return;
        this.pitched = !this.pitched;
        this.reorient(CesiumMath.toRadians(this.mode === 'weather' || !this.pitched ? -90 : -55));
        break;
      }
    }
    scene.requestRender();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const remove of this.cleanups) remove();
    this.searchPin.dispose();
    this.contextLabels.dispose();
    this.walkingRoute.dispose();
    this.pedestrianNetwork.dispose();
    this.indoorPoints.dispose();
    this.facilities.dispose();
    this.navigation.dispose();
    this.userLocation.dispose();
    this.trafficCameras.dispose();
    this.trainMotion.dispose();
    this.mtr.dispose();
    this.busStops.dispose();
    this.rainfall.dispose();
    this.basemapLayers.dispose();
    this.events.destroy();
    if (import.meta.env.DEV && window.__HK_SCENE__ === this.inspector) delete window.__HK_SCENE__;
    // The widget owns the primitive collections and any attached tileset.
    this.widget.destroy();
    this.markers.clear();
  }

  private focus(lng: number, lat: number, range: number, animate = true): void {
    const pitch =
      this.mode === 'weather' || !this.pitched ? -90 : this.mode === 'transport' ? -70 : -55;
    this.widget.camera.cancelFlight();
    const centre = Cartesian3.fromDegrees(lng, lat);
    const duration = !animate || this.reducedMotion.matches ? 0 : 0.85;
    if (this.flyToFramedTarget(centre, CesiumMath.toRadians(pitch), range, duration)) return;
    this.widget.camera.flyToBoundingSphere(new BoundingSphere(centre, 1), {
      duration,
      offset: new HeadingPitchRange(0, CesiumMath.toRadians(pitch), range),
    });
  }

  private reorient(pitch: number): void {
    const { camera, canvas, scene } = this.widget;
    const target = this.trafficTarget ?? this.busTarget ?? this.stationTarget ?? this.selected;
    if (target && this.viewportInsets.bottom > 0) {
      const centre = Cartesian3.fromDegrees(target.lng, target.lat);
      const depth = Cartesian3.dot(
        Cartesian3.subtract(centre, camera.positionWC, new Cartesian3()),
        camera.directionWC,
      );
      if (
        this.flyToFramedTarget(
          centre,
          pitch,
          Math.max(180, depth),
          this.reducedMotion.matches ? 0 : 0.35,
        )
      )
        return;
    }
    const centre = camera.pickEllipsoid(
      new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
      scene.globe.ellipsoid,
    );
    if (!centre) return;
    camera.flyToBoundingSphere(new BoundingSphere(centre, 1), {
      duration: this.reducedMotion.matches ? 0 : 0.35,
      offset: new HeadingPitchRange(0, pitch, Cartesian3.distance(camera.positionWC, centre)),
    });
  }

  private flyToFramedTarget(
    centre: Cartesian3,
    pitch: number,
    range: number,
    duration: number,
    heading = 0,
  ): boolean {
    const { camera, canvas } = this.widget;
    if (this.viewportInsets.bottom === 0 || !(camera.frustum instanceof PerspectiveFrustum))
      return false;
    const fovy = camera.frustum.fovy;
    if (fovy === undefined || canvas.clientHeight === 0) return false;
    const transform = Transforms.eastNorthUpToFixedFrame(centre);
    const localOffset = new Cartesian3(
      -Math.sin(heading) * Math.cos(pitch) * range,
      -Math.cos(heading) * Math.cos(pitch) * range,
      -Math.sin(pitch) * range,
    );
    const destination = Matrix4.multiplyByPoint(transform, localOffset, new Cartesian3());
    const direction = Matrix4.multiplyByPointAsVector(
      transform,
      new Cartesian3(
        Math.sin(heading) * Math.cos(pitch),
        Math.cos(heading) * Math.cos(pitch),
        Math.sin(pitch),
      ),
      new Cartesian3(),
    );
    const up = Matrix4.multiplyByPointAsVector(
      transform,
      new Cartesian3(
        -Math.sin(heading) * Math.sin(pitch),
        -Math.cos(heading) * Math.sin(pitch),
        Math.cos(pitch),
      ),
      new Cartesian3(),
    );
    const verticalFraction =
      (this.viewportInsets.bottom - this.viewportInsets.top) / canvas.clientHeight;
    const shift = verticalFraction * range * Math.tan(fovy / 2);
    // Translate the camera in its image plane, preserving real coordinates and Cesium pick rays.
    Cartesian3.subtract(
      destination,
      Cartesian3.multiplyByScalar(up, shift, new Cartesian3()),
      destination,
    );
    camera.flyTo({ destination, orientation: { direction, up }, duration });
    return true;
  }

  private updateMarkerSelection(): void {
    for (const marker of this.markers.values()) {
      const selected = marker.place.id === this.selected?.id;
      marker.point.color = selected ? COLOURS.selected : COLOURS.marker;
      marker.point.pixelSize = selected ? 19 : 12;
    }
  }

  setCityView(enabled: boolean): void {
    this.cityView = enabled && this.city.configured;
    this.pitched = this.cityView;
    this.widget.scene.screenSpaceCameraController.enableTilt =
      this.cityView && this.mode !== 'weather';
    this.city.setActive(this.cityView && this.mode !== 'weather');
    this.updateCityBasemap();
    this.reorient(CesiumMath.toRadians(this.cityView && this.mode !== 'weather' ? -55 : -90));
    this.reportStatus();
    this.widget.scene.requestRender();
  }

  setCityPresentation(presentation: CityPresentation): void {
    this.city.setPresentation(presentation);
    this.updateCityBasemap();
    this.reportStatus();
    this.widget.scene.requestRender();
  }

  private updateCityBasemap() {
    // Raster text warps with the ground in 3D; upright semantic labels stay readable.
    this.basemapLayers.setLabelVisibility(!this.cityView || this.mode === 'weather');
    this.basemapLayers.setMuted(
      this.cityView && this.mode !== 'weather' && this.city.presentationStyle === 'buildings',
    );
  }

  private requestCity(): void {
    this.city.warm();
  }

  private reportStatus(): void {
    if (this.disposed) return;
    const city = this.city.snapshot();
    const visible = this.cityView && this.mode !== 'weather';
    const message = this.basemapLayers.hasErrors
      ? 'Some map tiles could not load. Place search is still available.'
      : !visible
        ? `${basemapNames[this.basemap]} · 2D map`
        : city.state === 'loading'
          ? city.firstVisibleMs !== null
            ? 'Refining 3D detail…'
            : 'Preparing 3D · map remains usable'
          : city.state === 'ready'
            ? `3D city connected · ${basemapNames[this.basemap]}`
            : city.state === 'error'
              ? city.firstVisibleMs !== null
                ? 'Some 3D tiles unavailable · showing available coverage'
                : '3D detail unavailable · map remains usable'
              : this.basemap === 'none'
                ? 'Test scene · external map imagery disabled'
                : `${basemapNames[this.basemap]} · flat basemap · 3D city not connected`;
    this.options.onStatus({
      ready: true,
      message,
      cityLoading: visible && city.state === 'loading' && city.firstVisibleMs === null,
      cityUnavailable: visible && city.state === 'error',
      citySlow: visible && city.slow,
    });
  }

  private snapshot(): SceneDiagnostics {
    const { camera, canvas } = this.widget;
    const city = this.city.snapshot();
    const screenPoint = this.selected
      ? SceneTransforms.worldToWindowCoordinates(
          this.widget.scene,
          Cartesian3.fromDegrees(this.selected.lng, this.selected.lat, 8),
        )
      : undefined;
    return {
      renderer: 'cesium',
      mode: this.mode,
      quality: this.quality,
      selectedPlaceId: this.selected?.id ?? null,
      placeCount: this.markers.size,
      renderedFrames: this.renderedFrames,
      pendingGlobeTiles: this.pendingGlobeTiles,
      pendingCityTiles: city.network + city.processing,
      cityNetworkRequests: city.network,
      cityProcessingTiles: city.processing,
      failedCityTiles: city.failed,
      loadedCityTiles: city.loaded,
      unloadedCityTiles: city.unloaded,
      cityMemoryBytes: city.memoryBytes,
      cityCoverageReady: city.coverageReady,
      firstCityCoverageMs: city.firstCoverageMs,
      firstCityVisibleMs: city.firstVisibleMs,
      cityTiles: city.state,
      basemap: this.basemap,
      terrain: 'ellipsoid',
      canvas: { width: canvas.width, height: canvas.height },
      viewportInsets: { ...this.viewportInsets },
      selectedScreenPoint: screenPoint ? { x: screenPoint.x, y: screenPoint.y } : null,
      camera: {
        lng: CesiumMath.toDegrees(camera.positionCartographic.longitude),
        lat: CesiumMath.toDegrees(camera.positionCartographic.latitude),
        height: camera.positionCartographic.height,
        heading: CesiumMath.toDegrees(camera.heading),
        pitch: CesiumMath.toDegrees(camera.pitch),
      },
    };
  }
}
