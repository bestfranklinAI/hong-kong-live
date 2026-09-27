import type { RainfallSelection } from './RainfallLayer';
import type { Basemap, MapLanguage, SceneBasemap } from './basemaps';
import type { Place, Quality, ViewMode, TrafficCamera, StationSelection } from '@hk/contracts';

export interface SceneStatus {
  cityLoading?: boolean;
  ready: boolean;
  message: string;
}

export type SceneCommand = {
  location?: import('./UserLocation').LocationFix;
  type:
    | 'pick-route-point'
    | 'locate'
    | 'zoom-in'
    | 'zoom-out'
    | 'reset'
    | 'north'
    | 'toggle-pitch'
    | 'search-bus-area';
  sequence: number;
};

export interface MapSceneProps {
  routePicking?: boolean;
  onRoutePoint?: (point: { lat: number; lng: number } | null) => void;
  indoorLayout?: import('@hk/contracts').IndoorLayout;
  indoorFloor?: import('@hk/contracts').IndoorFloor;
  indoorSelectedId?: string;
  indoorPoints?: import('@hk/contracts').IndoorPoint[];
  onIndoorPointSelect?: (point: import('@hk/contracts').IndoorPoint) => void;
  walkingContext?: boolean;
  walkingShowHidden?: boolean;
  walkingRoute?: import('@hk/contracts').WalkingRoute | null;
  facilities?: import('@hk/contracts').SearchResult[];
  onFacilitySelect?: (result: import('@hk/contracts').SearchResult) => void;
  searchPin?: import('@hk/contracts').SearchResult | null;
  onSearchPinSelect?: () => void;
  cityView: boolean;
  onRotationChange?: (rotated: boolean) => void;
  trainMotion?: import('../features/trains/motion').TrainMotionInput | null;
  onTrainSelect?: (arrival: import('../features/trains/motion').TrainApproach) => void;
  onBusAreaSelect?: (area: { lng: number; lat: number } | null) => void;
  busStops?: import('@hk/contracts').BusStop[];
  selectedBusStop?: import('@hk/contracts').BusStop | null;
  onBusStopSelect?: (stop: import('@hk/contracts').BusStop) => void;
  stationSelection?: StationSelection | null;
  onStationSelect?: (selection: StationSelection) => void;
  cameras?: TrafficCamera[];
  selectedCamera?: TrafficCamera | null;
  onCameraSelect?: (camera: TrafficCamera) => void;
  rainfall?: RainfallSelection | null;
  places: Place[];
  selectedPlace: Place | null;
  mode: ViewMode;
  quality: Quality;
  basemap: Basemap;
  mapLanguage: MapLanguage;
  onSelect: (place: Place) => void;
  onStatus?: (status: SceneStatus) => void;
  command?: SceneCommand;
  /** Frame selection in the visible space above this overlay, when present. */
  frameAbove?: string;
}

export interface SceneDiagnostics {
  renderer: 'cesium';
  mode: ViewMode;
  quality: Quality;
  selectedPlaceId: string | null;
  placeCount: number;
  renderedFrames: number;
  pendingGlobeTiles: number;
  pendingCityTiles: number;
  cityTiles: 'not-configured' | 'loading' | 'ready' | 'error';
  basemap: SceneBasemap;
  terrain: 'ellipsoid';
  canvas: { width: number; height: number };
  viewportInsets: { top: number; bottom: number };
  selectedScreenPoint: { x: number; y: number } | null;
  camera: { lng: number; lat: number; height: number; heading: number; pitch: number };
}

export interface SceneInspector {
  snapshot: () => SceneDiagnostics;
  command: (type: SceneCommand['type']) => void;
}

declare global {
  interface Window {
    /** Development-only semantic access for browser tests and performance inspection. */
    __HK_SCENE__?: SceneInspector;
  }
}
