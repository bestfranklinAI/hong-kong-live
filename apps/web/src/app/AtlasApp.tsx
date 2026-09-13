import { DiscoverySheet } from '../features/mobile/DiscoverySheet';
import { MapSettings } from '../features/mobile/MapSettings';
import { MobileSearch, MobileSearchResults } from '../features/mobile/MobileSearch';
import { haptic, type SheetSnap } from '../features/mobile/sheet-motion';
import { WindyWeather } from '../features/windy/WindyWeather';
import type { BusSearchArea } from '../features/buses/NearbyStops';
import { useBuses } from '../features/buses/use-buses';
import { BusesPanel } from '../features/buses/BusesPanel';
import { useCameras } from '../features/cameras/use-cameras';
import { CamerasPanel } from '../features/cameras/CamerasPanel';
import { useRainfall } from '../features/live/use-rainfall';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  ArrowUpRight,
  Bookmark,
  CloudSun,
  Compass,
  Map,
  TrainFront,
  Settings2,
  Layers,
  LocateFixed,
} from 'lucide-react';
import type { Category, Place, ViewMode, TrafficCamera, StationSelection } from '@hk/contracts';
import { ExplorePanel } from '../features/explore/ExplorePanel';
import { getPlace, places } from '../features/explore/places';
import { PlaceDetail } from '../features/explore/PlaceDetail';
import { WeatherPanel } from '../features/live/WeatherPanel';
import { TransportPanel } from '../features/live/TransportPanel';
import { useWeather, useLineArrivals } from '../features/live/queries';
import type { SceneCommand, SceneStatus } from '../scene/types';
import { HongKongMark, IconButton } from '../shared/ui';
import { usePreferences } from './preferences';
import { AboutDialog } from './AboutDialog';
import { MapControls } from './MapControls';
import { useMobileLayout } from '../shared/use-mobile';

const MapScene = lazy(() => import('../scene/MapScene'));
const modes = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'transport', label: 'Transport', icon: TrainFront },
] as const;

export function AtlasApp() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const selectedPlace = search.place ? (getPlace(search.place) ?? null) : null;
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>({
    ready: false,
    message: 'Bringing Hong Kong into view…',
  });
  const [trainAnimation, setTrainAnimation] = useState(true);
  const [pickedTrain, setPickedTrain] = useState<import('@hk/contracts').Arrival | null>(null);
  const [weatherView, setWeatherView] = useState<'windy' | 'hko'>('windy');
  const windyActive = search.mode === 'weather' && weatherView === 'windy';
  const [transportLayer, setTransportLayer] = useState<'mtr' | 'cameras' | 'buses'>('mtr');
  const [selectedCamera, setSelectedCamera] = useState<TrafficCamera | null>(null);
  const camerasEnabled = search.mode === 'transport' && transportLayer === 'cameras';
  const cameras = useCameras(camerasEnabled);
  const busesEnabled = search.mode === 'transport' && transportLayer === 'buses';
  const buses = useBuses(busesEnabled);
  const [busArea, setBusArea] = useState<BusSearchArea>();
  const selectCamera = useCallback((camera: TrafficCamera) => {
    setSelectedCamera(camera);
    setPanelExpanded(true);
    document.querySelector('.panel-scroll')?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const [command, setCommand] = useState<SceneCommand>();
  const [savedOnly, setSavedOnly] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek');
  const panelExpanded = sheetSnap !== 'peek';
  function setPanelExpanded(expanded: boolean) {
    setSheetSnap(expanded ? 'half' : 'peek');
  }
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [windyControls, setWindyControls] = useState<HTMLDivElement | null>(null);
  const basemap = usePreferences((state) => state.basemap);
  const mapLanguage = usePreferences((state) => state.mapLanguage);
  const setBasemap = usePreferences((state) => state.setBasemap);
  const setMapLanguage = usePreferences((state) => state.setMapLanguage);
  const quality = usePreferences((state) => state.quality);
  const setQuality = usePreferences((state) => state.setQuality);
  const savedCount = usePreferences((state) => state.savedIds.length);
  const weather = useWeather();
  const rain = useRainfall(search.mode === 'weather' && !windyActive);
  const mobile = useMobileLayout();
  const showPlaceDetail = Boolean(selectedPlace && search.mode === 'explore');

  const selectPlace = useCallback(
    (place: Place) => {
      void navigate({
        search: (previous) => ({
          ...previous,
          place: place.id,
          line: place.station?.line,
          station: place.station?.code,
        }),
      });
      if (search.mode === 'explore') setPanelExpanded(true);
    },
    [navigate, search.mode],
  );
  const clearSelection = useCallback(() => {
    void navigate({ search: (previous) => ({ ...previous, place: undefined }) });
  }, [navigate]);
  const transitSelection = {
    line: search.line ?? selectedPlace?.station?.line ?? 'ISL',
    station: search.station ?? selectedPlace?.station?.code ?? 'ADM',
  };
  const motionEnabled = search.mode === 'transport' && transportLayer === 'mtr';
  const motionArrivals = useLineArrivals(transitSelection.line, motionEnabled && trainAnimation);
  function selectStation(selection: StationSelection) {
    setPanelExpanded(true);
    const place = places.find((place) => place.station?.code === selection.station);
    void navigate({ search: (previous) => ({ ...previous, ...selection, place: place?.id }) });
  }
  function setMode(mode: ViewMode) {
    haptic();
    void navigate({ search: (previous) => ({ ...previous, mode }) });
  }
  function issueCommand(type: SceneCommand['type']) {
    setCommand((previous) => ({ type, sequence: (previous?.sequence ?? 0) + 1 }));
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.target instanceof Element && event.target.closest('[role="dialog"]'))
      )
        return;
      if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement)) clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  return (
    <div
      onClickCapture={(event) => {
        if (mobile && (event.target as Element).closest('button')) haptic();
      }}
      className={`atlas-app ${mobile ? 'mobile-map-app' : ''} ${panelExpanded ? 'panel-expanded' : ''} ${showPlaceDetail ? 'has-selection' : ''}`}
    >
      <a className="skip-link" href="#discovery">
        Skip to places and information
      </a>
      <header className="app-header">
        <a className="brand" href="/" aria-label="Hong Kong Live home">
          <HongKongMark />
          <span>
            Hong Kong
            <span className="brand-live">
              Live
              <span />
            </span>
          </span>
        </a>
        <nav className="mode-switch" aria-label="Explore map modes">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={search.mode === id ? 'active' : ''}
              aria-current={search.mode === id ? 'page' : undefined}
              onClick={() => setMode(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="header-weather"
            onClick={() => setMode('weather')}
            aria-label="Open weather"
          >
            <CloudSun size={21} />
            <strong>
              {weather.data?.data?.temperature != null ? `${weather.data.data.temperature}°` : '—'}
            </strong>
            <span>
              {weather.data?.mode === 'fixture'
                ? 'Test snapshot'
                : weather.data?.status === 'stale'
                  ? 'Last report'
                  : 'Hong Kong'}
            </span>
          </button>
          <IconButton
            label={`Saved places (${savedCount})`}
            className={savedOnly ? 'is-saved' : ''}
            onClick={() => {
              setSavedOnly((previous) => !previous);
              setMode('explore');
            }}
          >
            <Bookmark size={19} fill={savedOnly ? 'currentColor' : 'none'} />
          </IconButton>
          {mobile && (
            <IconButton
              label="Map settings"
              onClick={() => {
                haptic();
                setSettingsOpen(true);
              }}
            >
              <Settings2 size={19} />
            </IconButton>
          )}
          <AboutDialog />
        </div>
      </header>
      <MapSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        command={issueCommand}
        status={sceneStatus.message}
      />
      <main className="atlas-workspace">
        {windyActive ? (
          <WindyWeather
            onObservations={() => setWeatherView('hko')}
            controlsHost={mobile ? windyControls : undefined}
          />
        ) : (
          <>
            <section className="map-surface" aria-label="Interactive map of Hong Kong">
              <Suspense
                fallback={
                  <div className="map-loading">
                    <HongKongMark />
                    <p>Bringing Hong Kong into view…</p>
                  </div>
                }
              >
                <MapScene
                  trainMotion={
                    motionEnabled
                      ? {
                          selection: transitSelection,
                          stationFeeds: motionArrivals,
                          enabled: trainAnimation,
                        }
                      : null
                  }
                  onTrainSelect={(approach) => {
                    selectStation({ line: approach.line, station: approach.station });
                    setPickedTrain(approach.arrival);
                    setPanelExpanded(true);
                  }}
                  onRotationChange={setRotated}
                  frameAbove={mobile ? '.discovery-panel' : undefined}
                  rainfall={
                    rain.publication
                      ? { publication: rain.publication, index: rain.index, style: rain.style }
                      : null
                  }
                  cameras={camerasEnabled ? (cameras.data?.data ?? undefined) : undefined}
                  selectedCamera={camerasEnabled ? selectedCamera : null}
                  stationSelection={
                    search.mode === 'transport' && transportLayer === 'mtr'
                      ? transitSelection
                      : null
                  }
                  onBusAreaSelect={(area) =>
                    setBusArea(area ? { ...area, revision: Date.now() } : null)
                  }
                  busStops={busesEnabled ? (buses.stopFeed?.data ?? undefined) : undefined}
                  selectedBusStop={busesEnabled ? buses.selected : null}
                  onBusStopSelect={(stop) => {
                    buses.setSelection({ ...buses.selection, seq: stop.seq });
                    setPanelExpanded(true);
                  }}
                  onStationSelect={selectStation}
                  onCameraSelect={selectCamera}
                  places={places}
                  selectedPlace={selectedPlace}
                  mode={search.mode}
                  basemap={basemap}
                  mapLanguage={mapLanguage}
                  quality={quality}
                  onSelect={selectPlace}
                  onStatus={setSceneStatus}
                  command={command}
                />
              </Suspense>
            </section>
          </>
        )}
        {(!windyActive || mobile) && (
          <>
            <DiscoverySheet
              mobile={mobile}
              snap={sheetSnap}
              onSnap={setSheetSnap}
              mode={search.mode}
              header={
                <MobileSearch
                  query={search.q ?? ''}
                  category={search.category ?? 'all'}
                  onFocus={() => setSheetSnap('full')}
                  onQuery={(q) => {
                    setMode('explore');
                    void navigate({
                      replace: true,
                      search: (previous) => ({
                        ...previous,
                        mode: 'explore',
                        q: q || undefined,
                        place: undefined,
                      }),
                    });
                  }}
                  onCategory={(category: Category | 'all') => {
                    setSheetSnap('half');
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        mode: 'explore',
                        place: undefined,
                        category: category === 'all' ? undefined : category,
                      }),
                    });
                  }}
                  onWeather={() => {
                    setMode('weather');
                    setSheetSnap('half');
                  }}
                />
              }
            >
              <div
                className="panel-scroll"
                onFocusCapture={(event) => {
                  if (mobile && event.target.matches(':focus-visible')) setSheetSnap('full');
                }}
              >
                {mobile && windyActive && <div ref={setWindyControls} />}
                {mobile && showPlaceDetail && selectedPlace && (
                  <PlaceDetail
                    key={selectedPlace.id}
                    place={selectedPlace}
                    onClose={clearSelection}
                    onTransit={() => setMode('transport')}
                  />
                )}
                {mobile && search.mode === 'explore' && (
                  <MobileSearchResults
                    query={search.q ?? ''}
                    onStation={(selection) => {
                      setMode('transport');
                      selectStation(selection);
                    }}
                    onWeather={() => {
                      setWeatherView('hko');
                      setMode('weather');
                      setSheetSnap('full');
                    }}
                  />
                )}
                {search.mode === 'transport' && (
                  <div className="transport-tabs" role="group" aria-label="Transport layer">
                    <button
                      aria-pressed={transportLayer === 'mtr'}
                      onClick={() => setTransportLayer('mtr')}
                    >
                      MTR trains
                    </button>
                    <button
                      aria-pressed={transportLayer === 'buses'}
                      onClick={() => setTransportLayer('buses')}
                    >
                      Buses
                    </button>
                    <button
                      aria-pressed={transportLayer === 'cameras'}
                      onClick={() => setTransportLayer('cameras')}
                    >
                      Traffic cameras
                    </button>
                  </div>
                )}
                {windyActive ? null : search.mode === 'explore' ? (
                  <ExplorePanel
                    selectedId={search.place}
                    onSelect={selectPlace}
                    savedOnly={savedOnly}
                    onToggleSavedOnly={() => setSavedOnly((previous) => !previous)}
                    query={search.q ?? ''}
                    category={search.category ?? 'all'}
                    onQuery={(q) => {
                      void navigate({
                        replace: true,
                        search: (previous) => ({ ...previous, q: q || undefined }),
                      });
                    }}
                    onCategory={(category) => {
                      void navigate({
                        search: (previous) => ({
                          ...previous,
                          category: category === 'all' ? undefined : category,
                        }),
                      });
                    }}
                  />
                ) : search.mode === 'weather' ? (
                  <>
                    <button className="windy-hko" onClick={() => setWeatherView('windy')}>
                      Windy forecast map <ArrowUpRight size={16} />
                    </button>
                    <WeatherPanel rain={rain} />
                  </>
                ) : transportLayer === 'buses' ? (
                  <BusesPanel
                    bus={buses}
                    area={busArea}
                    onSearchArea={() => issueCommand('search-bus-area')}
                  />
                ) : transportLayer === 'cameras' ? (
                  <CamerasPanel query={cameras} selected={selectedCamera} onSelect={selectCamera} />
                ) : (
                  <TransportPanel
                    selection={transitSelection}
                    onSelect={selectStation}
                    animation={trainAnimation}
                    onAnimation={setTrainAnimation}
                    pickedTrain={pickedTrain}
                  />
                )}
              </div>
              <div className="panel-footer">
                <span className="status-dot" />
                Made of open data. Full of possibility.
                <ArrowUpRight size={14} />
              </div>
            </DiscoverySheet>
            <div className="map-location">
              <span className="location-dot" />
              <span>HONG KONG SAR</span>
              <span className="coordinate-label">22.28° N · 114.16° E</span>
            </div>
            <div className="basemap-controls" aria-label="Map layers">
              <label>
                <span>Map style</span>
                <select
                  aria-label="Map style"
                  value={basemap}
                  onChange={(e) => setBasemap(e.target.value as typeof basemap)}
                >
                  <option value="landsd-map">Map</option>
                  <option value="landsd-aerial">Aerial</option>
                  <option value="openstreetmap">OSM</option>
                </select>
              </label>
              {basemap !== 'openstreetmap' && (
                <label>
                  <span>Map labels</span>
                  <select
                    aria-label="Map label language"
                    value={mapLanguage}
                    onChange={(e) => setMapLanguage(e.target.value as typeof mapLanguage)}
                  >
                    <option value="en">English</option>
                    <option value="tc">繁體中文</option>
                  </select>
                </label>
              )}
            </div>
            {!mobile && !windyActive && (
              <MapControls command={issueCommand} quality={quality} onQuality={setQuality} />
            )}
            {mobile && !windyActive && (
              <div className="mobile-map-actions" aria-label="Map actions">
                <IconButton
                  label="Locate me"
                  onClick={() => {
                    haptic();
                    if (!navigator.geolocation) {
                      setLocationMessage('Location is not available in this browser.');
                      return;
                    }
                    setLocationMessage('Finding your location…');
                    navigator.geolocation.getCurrentPosition(
                      ({ coords }) => {
                        setCommand((previous) => ({
                          type: 'locate',
                          sequence: (previous?.sequence ?? 0) + 1,
                          location: { lng: coords.longitude, lat: coords.latitude },
                        }));
                        setSheetSnap('peek');
                        setLocationMessage('');
                      },
                      () =>
                        setLocationMessage(
                          'Could not access location. Check location permission and use an HTTPS connection.',
                        ),
                      { timeout: 10000, maximumAge: 30000 },
                    );
                  }}
                >
                  <LocateFixed size={21} />
                </IconButton>
                <IconButton
                  label="Choose map layers"
                  onClick={() => {
                    haptic();
                    setSettingsOpen(true);
                  }}
                >
                  <Layers size={21} />
                </IconButton>
                {rotated && (
                  <IconButton
                    label="Point map north"
                    onClick={() => {
                      haptic();
                      issueCommand('north');
                    }}
                  >
                    <Compass size={21} />
                  </IconButton>
                )}
              </div>
            )}
            {mobile && locationMessage && (
              <button
                className="mobile-map-message"
                role="status"
                onClick={() => setLocationMessage('')}
              >
                {locationMessage}
              </button>
            )}
            {mobile && motionEnabled && trainAnimation && (
              <span className="mobile-estimate-label">Train positions estimated</span>
            )}
            {!mobile && selectedPlace && showPlaceDetail && (
              <PlaceDetail
                key={selectedPlace.id}
                place={selectedPlace}
                onClose={clearSelection}
                onTransit={() => setMode('transport')}
              />
            )}
            {!selectedPlace && search.mode === 'explore' && (
              <div className="map-invitation">
                <span className="invitation-icon">
                  <Map size={22} strokeWidth={1.3} />
                </span>
                <div>
                  <strong>There’s always another way to see it.</strong>
                  <span>Choose a place. Follow your curiosity.</span>
                </div>
              </div>
            )}
            <div className={`scene-status ${sceneStatus.ready ? 'ready' : ''}`} role="status">
              <span />
              {motionEnabled && trainAnimation ? 'Estimated train positions · ' : ''}
              {sceneStatus.message}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
