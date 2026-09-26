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
  Cesium3DTileset,
  CesiumWidget,
  Color,
  EllipsoidTerrainProvider,
  DistanceDisplayCondition,
  HeadingPitchRange,
  HorizontalOrigin,
  LabelCollection,
  LabelStyle,
  Math as CesiumMath,
  Matrix4,
  NearFarScalar,
  PerspectiveFrustum,
  PointPrimitiveCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  SceneTransforms,
  Transforms,
  VerticalOrigin,
  type Label,
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
  ink: Color.fromCssColorString('#173d3a'),
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
    resolution: 1.25,
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
  label: Label;
}

interface SceneOptions {
  onRotationChange?: (rotated: boolean) => void;
  onTrainSelect?: (arrival: import('../features/trains/motion').TrainApproach) => void;
  onBusAreaSelect?: (area: { lng: number; lat: number } | null) => void;
  onSelect: (place: Place) => void;
  onCameraSelect?: (camera: TrafficCamera) => void;
  onBusStopSelect?: (stop: BusStop) => void;
  onStationSelect?: (selection: StationSelection) => void;
  onStatus: (status: SceneStatus) => void;
  creditContainer: HTMLElement;
  performanceOutput?: HTMLElement;
  tilesetUrl?: string;
  basemap: SceneBasemap;
  mapLanguage: MapLanguage;
}

/** Owns every mutable engine object; React sends infrequent semantic commands only. */
export class SceneController {
  private readonly userLocation: UserLocation;
  private readonly trafficCameras: TrafficCameras;
  private readonly mtr: MtrStations;
  private readonly trainMotion: TrainMotion;
  private readonly busStops: BusStops;
  private busTarget: BusStop | null = null;
  private stationCode?: string;
  private stationTarget: { lng: number; lat: number } | null = null;
  private cameraId: string | undefined;
  private trafficTarget: TrafficCamera | null = null;
  private readonly rainfall: RainfallLayer;
  private readonly widget: CesiumWidget;
  private readonly points: PointPrimitiveCollection;
  private readonly labels: LabelCollection;
  private readonly events: ScreenSpaceEventHandler;
  private readonly cleanups: Array<() => void> = [];
  private readonly markers = new Map<string, Marker>();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly inspector: SceneInspector;
  private tileset?: Cesium3DTileset;
  private mode: ViewMode = 'explore';
  private quality: Quality = 'balanced';
  private selected: Place | null = null;
  private pitched = true;
  private cityView = false;
  private cityRequested = false;
  private disposed = false;
  private renderedFrames = 0;
  private pendingGlobeTiles = 0;
  private pendingCityTiles = 0;
  private cityState: SceneDiagnostics['cityTiles'] = 'not-configured';
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

    this.userLocation = new UserLocation(this.widget);
    this.trafficCameras = new TrafficCameras(this.widget);
    this.mtr = new MtrStations(this.widget);
    this.trainMotion = new TrainMotion(this.widget);
    this.busStops = new BusStops(this.widget);
    this.rainfall = new RainfallLayer(this.widget);
    this.basemapLayers = new BasemapLayers(this.widget.imageryLayers, () => this.reportStatus());
    if (import.meta.env.VITE_SCENE_DIAGNOSTICS === 'true' && options.performanceOutput) {
      const measurements = new ScenePerformance(this.widget, options.performanceOutput);
      this.cleanups.push(() => measurements.dispose());
    }
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
    this.labels = scene.primitives.add(new LabelCollection({ scene }));
    this.events = new ScreenSpaceEventHandler(this.widget.canvas);
    this.events.setInputAction(
      () => this.command('zoom-in'),
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    this.events.setInputAction((event: { position: Cartesian2 }) => {
      const picked: unknown = scene.pick(event.position, 12, 12);
      if (typeof picked !== 'object' || picked === null || !('id' in picked)) return;
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
    this.basemapLayers.update(basemapLayerDefinitions(basemap, language));
    this.reportStatus();
    this.widget.scene.requestRender();
  }

  setPlaces(places: Place[]): void {
    if (this.disposed) return;
    this.points.removeAll();
    this.labels.removeAll();
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
      const label = this.labels.add({
        id: place.id,
        position,
        text: place.name,
        font: '600 13px system-ui, sans-serif',
        fillColor: COLOURS.ink,
        outlineColor: Color.WHITE,
        outlineWidth: 4,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -15),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(800, 1, 25_000, 0.65),
      });
      this.markers.set(place.id, { place, point, label });
    }
    this.updateMarkerSelection();
    this.widget.scene.requestRender();
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
    this.labels.show = this.mode === 'explore';
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
    this.labels.show = mode === 'explore';
    // Globe imagery is hidden by opaque city meshes; weather gets a clear top-down surface.
    if (this.tileset) this.tileset.show = this.cityView && mode !== 'weather';
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
    if (this.tileset) {
      this.tileset.maximumScreenSpaceError = preset.screenSpaceError;
      this.tileset.cacheBytes = preset.cacheBytes;
      this.tileset.maximumCacheOverflowBytes = preset.cacheBytes / 2;
    }
    this.widget.scene.requestRender();
  }

  setViewportInsets(insets: { top: number; bottom: number }): void {
    if (this.disposed) return;
    const height = this.widget.canvas.clientHeight;
    const width = this.widget.canvas.clientWidth;
    // Always retain a usable viewing strip even on short screens or large text settings.
    const top = Math.max(0, Math.min(insets.top, height * 0.25));
    const bottom = Math.max(0, Math.min(insets.bottom, height - top - 100));
    if (
      Math.abs(top - this.viewportInsets.top) < 1 &&
      Math.abs(bottom - this.viewportInsets.bottom) < 1 &&
      width === this.viewportSize.width &&
      height === this.viewportSize.height
    )
      return;
    this.viewportInsets = { top, bottom };
    this.viewportSize = { width, height };
    this.widget.resize();
    if (this.trafficTarget) this.focus(this.trafficTarget.lng, this.trafficTarget.lat, 3500, false);
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

  locate(location: LocationFix): void {
    if (!this.disposed && Number.isFinite(location.lng) && Number.isFinite(location.lat)) {
      this.userLocation.set(location);
      this.focus(location.lng, location.lat, 1800);
    }
  }

  command(type: SceneCommand['type']): void {
    if (this.disposed) return;
    const { camera, scene } = this.widget;
    camera.cancelFlight();
    switch (type) {
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
  ): boolean {
    const { camera, canvas } = this.widget;
    if (this.viewportInsets.bottom === 0 || !(camera.frustum instanceof PerspectiveFrustum))
      return false;
    const fovy = camera.frustum.fovy;
    if (fovy === undefined || canvas.clientHeight === 0) return false;
    const transform = Transforms.eastNorthUpToFixedFrame(centre);
    const localOffset = new Cartesian3(0, -Math.cos(pitch) * range, -Math.sin(pitch) * range);
    const destination = Matrix4.multiplyByPoint(transform, localOffset, new Cartesian3());
    const direction = Matrix4.multiplyByPointAsVector(
      transform,
      new Cartesian3(0, Math.cos(pitch), Math.sin(pitch)),
      new Cartesian3(),
    );
    const up = Matrix4.multiplyByPointAsVector(
      transform,
      new Cartesian3(0, -Math.sin(pitch), Math.cos(pitch)),
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
      marker.label.fillColor = selected ? COLOURS.selected : COLOURS.ink;
      marker.label.scale = selected ? 1.1 : 1;
      // Keep the regional view readable while preserving the selected name.
      marker.label.distanceDisplayCondition = selected
        ? new DistanceDisplayCondition()
        : new DistanceDisplayCondition(0, 6000);
    }
  }

  setCityView(enabled: boolean): void {
    this.cityView = enabled && Boolean(this.options.tilesetUrl);
    this.pitched = this.cityView;
    this.widget.scene.screenSpaceCameraController.enableTilt =
      this.cityView && this.mode !== 'weather';
    // Keep the same tileset and its bounded cache when returning to the flat map.
    if (this.tileset) this.tileset.show = this.cityView && this.mode !== 'weather';
    if (this.cityView && !this.cityRequested && this.options.tilesetUrl) {
      this.cityRequested = true;
      void this.loadCity(this.options.tilesetUrl);
    }
    this.reorient(CesiumMath.toRadians(this.cityView && this.mode !== 'weather' ? -55 : -90));
    this.reportStatus();
    this.widget.scene.requestRender();
  }

  private async loadCity(url: string): Promise<void> {
    this.cityState = 'loading';
    this.reportStatus();
    try {
      const parsed = new URL(url, window.location.origin);
      if (!['https:', 'http:'].includes(parsed.protocol))
        throw new Error('Unsupported tileset protocol');
      const preset = QUALITY[this.quality];
      const tileset = await Cesium3DTileset.fromUrl(parsed.toString(), {
        maximumScreenSpaceError: preset.screenSpaceError,
        cacheBytes: preset.cacheBytes,
        maximumCacheOverflowBytes: preset.cacheBytes / 2,
        dynamicScreenSpaceError: true,
        foveatedScreenSpaceError: true,
        preloadWhenHidden: false,
        preloadFlightDestinations: true,
        // Load coarse coverage first and retain parents until their replacements are ready.
        skipLevelOfDetail: false,
        progressiveResolutionHeightFraction: 0.3,
        cullRequestsWhileMovingMultiplier: 20,
        foveatedTimeDelay: 0.1,
      });
      // A StrictMode remount can finish after its first widget has been disposed.
      if (this.disposed) {
        tileset.destroy();
        return;
      }
      this.tileset = this.widget.scene.primitives.add(tileset);
      // Quality may have changed while the manifest was loading.
      this.setQuality(this.quality);
      tileset.show = this.cityView && this.mode !== 'weather';
      this.cleanups.push(
        tileset.loadProgress.addEventListener((pending: number, processing: number) => {
          this.pendingCityTiles = pending + processing;
          const next = tileset.tilesLoaded ? 'ready' : 'loading';
          if (this.cityState !== 'error' && this.cityState !== next) {
            this.cityState = next;
            this.reportStatus();
          }
        }),
      );
      this.cleanups.push(
        tileset.tileFailed.addEventListener(() => {
          this.cityState = 'error';
          this.reportStatus();
        }),
      );
      this.cleanups.push(
        tileset.allTilesLoaded.addEventListener(() => {
          if (this.cityState !== 'ready') {
            this.cityState = 'ready';
            this.reportStatus();
          }
        }),
      );
      this.reportStatus();
      this.widget.scene.requestRender();
    } catch {
      if (this.disposed) return;
      this.cityState = 'error';
      this.cityRequested = false; // A later 2D → 3D toggle can retry a failed manifest.
      this.reportStatus();
    }
  }

  private reportStatus(): void {
    if (this.disposed) return;
    const cityVisible = this.cityView && this.mode !== 'weather';
    const message = this.basemapLayers.hasErrors
      ? 'Some map tiles could not load. Place search is still available.'
      : !cityVisible
        ? `${basemapNames[this.basemap]} · 2D map`
        : this.cityState === 'loading'
          ? 'Loading the connected 3D city…'
          : this.cityState === 'ready'
            ? `3D city connected · ${basemapNames[this.basemap]}`
            : this.cityState === 'error'
              ? this.tileset
                ? 'Some 3D tiles unavailable · showing available coverage'
                : '3D city unavailable · showing the flat basemap'
              : this.basemap === 'none'
                ? 'Test scene · external map imagery disabled'
                : `${basemapNames[this.basemap]} · flat basemap · 3D city not connected`;
    this.options.onStatus({
      ready: true,
      message,
      cityLoading: cityVisible && this.cityState === 'loading',
    });
  }

  private snapshot(): SceneDiagnostics {
    const { camera, canvas } = this.widget;
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
      pendingCityTiles: this.pendingCityTiles,
      cityTiles: this.cityState,
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
