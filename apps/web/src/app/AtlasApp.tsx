import { indoorCategoryLabels, type IndoorMapChoice } from '../features/navigation/indoor-map';
import { WalkingPlanner } from '../features/navigation/WalkingPlanner';
import { SelectedSearchPlace } from '../features/search/SelectedSearchPlace';
import { coordinateResult, withinHongKong, type SearchResult } from '@hk/contracts';
import { CityViewControl } from '../scene/CityViewControl';
import { DiscoverySheet } from '../features/mobile/DiscoverySheet';
import { MapSettings } from '../features/mobile/MapSettings';
import { MobileSearch } from '../features/mobile/MobileSearch';
import { haptic, type SheetSnap } from '../features/mobile/sheet-motion';
import { WindyWeather } from '../features/windy/WindyWeather';
import type { BusSearchArea } from '../features/buses/NearbyStops';
import { useBuses } from '../features/buses/use-buses';
import { BusesPanel } from '../features/buses/BusesPanel';
import { useCameras } from '../features/cameras/use-cameras';
import { CamerasPanel } from '../features/cameras/CamerasPanel';
import { useRainfall } from '../features/live/use-rainfall';
import { lazy, Suspense, useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  ArrowUpRight,
  Bookmark,
  CloudSun,
  Compass,
  TrainFront,
  Settings2,
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
import { useFacilities } from '../features/explore/facilities';

const MapScene = lazy(() => import('../scene/MapScene'));
const modes = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'transport', label: 'Transport', icon: TrainFront },
] as const;

export function AtlasApp() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const facilities = useFacilities(search.mode === 'explore');
  const visibleFacilities = useMemo(
    () =>
      search.mode === 'explore' && search.facility
        ? facilities.data?.records.filter((row) => row.facility?.category === search.facility)
        : undefined,
    [facilities.data, search.facility, search.mode],
  );
  const [searchSelection, setSearchSelection] = useState<SearchResult | null>(null);
  function selectFacilityCategory(facility?: import('@hk/contracts').FacilityCategory) {
    setSavedOnly(false);
    setSearchSelection(null);
    setSheetSnap('half');
    void navigate({
      search: (previous) => ({
        ...previous,
        mode: 'explore',
        facility,
        q: undefined,
        category: undefined,
        place: undefined,
        pinLat: undefined,
        pinLng: undefined,
      }),
    });
  }
  const searchPin = useMemo(() => {
    if (search.pinLat === undefined || search.pinLng === undefined) return null;
    if (
      searchSelection?.location?.lat === search.pinLat &&
      searchSelection.location.lng === search.pinLng
    )
      return searchSelection;
    return coordinateResult({ lat: search.pinLat, lng: search.pinLng });
  }, [search.pinLat, search.pinLng, searchSelection]);
  const selectedPlace = search.place ? (getPlace(search.place) ?? null) : null;
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>({
    ready: false,
    message: 'Bringing Hong Kong into view…',
  });
  const [indoorMap, setIndoorMap] = useState<IndoorMapChoice | null>(null);
  const [indoorCandidate, setIndoorCandidate] = useState<
    import('@hk/contracts').IndoorPoint | null
  >(null);
  const showIndoorMap = useCallback((choice: IndoorMapChoice | null) => {
    setIndoorMap(choice);
    setIndoorCandidate(null);
    if (choice) setSheetSnap('peek');
  }, []);
  const [routePicker, setRoutePicker] = useState<{
    select: (point: import('@hk/contracts').RouteEndpoint) => void;
  } | null>(null);
  const [routePickError, setRoutePickError] = useState('');
  const [stationRouteSeed, setStationRouteSeed] = useState<{
    point: import('@hk/contracts').RouteEndpoint;
    role: 'start' | 'end';
  } | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [routeShowHidden, setRouteShowHidden] = useState(false);
  const [routeContext, setRouteContext] = useState(false);
  const [walkingRoute, setWalkingRoute] = useState<import('@hk/contracts').WalkingRoute | null>(
    null,
  );
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
  const cityView = usePreferences((state) => state.cityView);
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
  function planFromStation(point: import('@hk/contracts').RouteEndpoint, role: 'start' | 'end') {
    setStationRouteSeed({ point, role });
    setWalkingRoute(null);
    setPlannerOpen(true);
    setSheetSnap('full');
    document.querySelector('.panel-scroll')?.scrollTo({ top: 0 });
  }
  const showPlaceDetail = Boolean(selectedPlace && search.mode === 'explore' && !plannerOpen);

  const selectPlace = useCallback(
    (place: Place) => {
      void navigate({
        search: (previous) => ({
          ...previous,
          place: place.id,
          pinLat: undefined,
          pinLng: undefined,
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
    setRoutePicker(null);
    setPlannerOpen(false);
    setRouteContext(false);
    setWalkingRoute(null);
    haptic();
    void navigate({ search: (previous) => ({ ...previous, mode }) });
  }
  function selectSearchResult(row: SearchResult) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (row.placeId) {
      const place = getPlace(row.placeId);
      if (place) {
        selectPlace(place);
        return;
      }
    }
    if (row.station) {
      setTransportLayer('mtr');
      void navigate({
        search: (previous) => ({
          ...previous,
          mode: 'transport',
          ...row.station,
          place: undefined,
          pinLat: undefined,
          pinLng: undefined,
          q: undefined,
        }),
      });
      setSheetSnap('half');
      return;
    }
    if (!row.location) return;
    setSearchSelection(row);
    void navigate({
      search: (previous) => ({
        ...previous,
        mode: 'explore',
        place: undefined,
        pinLat: row.location!.lat,
        pinLng: row.location!.lng,
        q: undefined,
      }),
    });
    setSheetSnap('peek');
  }
  function closeSearchPin() {
    setSearchSelection(null);
    void navigate({
      search: (previous) => ({ ...previous, pinLat: undefined, pinLng: undefined }),
    });
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
        cityView={plannerOpen && search.mode === 'explore' ? routeContext : undefined}
        onCityViewChange={plannerOpen && search.mode === 'explore' ? setRouteContext : undefined}
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
                  facilities={visibleFacilities}
                  indoorLayout={search.mode === 'explore' ? indoorMap?.layout : undefined}
                  indoorFloor={search.mode === 'explore' ? indoorMap?.floor : undefined}
                  indoorPoints={search.mode === 'explore' ? indoorMap?.points : undefined}
                  indoorSelectedId={indoorCandidate?.id}
                  onIndoorPointSelect={setIndoorCandidate}
                  onFacilitySelect={selectSearchResult}
                  searchPin={search.mode === 'explore' ? searchPin : null}
                  onSearchPinSelect={() => setSheetSnap('half')}
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
                  frameAbove={
                    mobile ? (indoorMap ? '.indoor-map-card' : '.discovery-panel') : undefined
                  }
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
                  places={search.mode === 'explore' && search.facility ? [] : places}
                  selectedPlace={selectedPlace}
                  mode={search.mode}
                  routePicking={Boolean(routePicker) && search.mode === 'explore'}
                  onRoutePoint={(point) => {
                    if (!routePicker) return;
                    if (!point || !withinHongKong(point)) {
                      setRoutePickError('Move the pin within Hong Kong.');
                      return;
                    }
                    routePicker.select({
                      ...point,
                      name: `Map point (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`,
                    });
                    setRoutePicker(null);
                    setSheetSnap('full');
                  }}
                  walkingContext={routeContext && !indoorMap && !routePicker}
                  walkingShowHidden={routeShowHidden}
                  cityView={
                    search.mode === 'explore' && (indoorMap || routePicker)
                      ? false
                      : plannerOpen && search.mode === 'explore'
                        ? routeContext
                        : cityView
                  }
                  walkingRoute={search.mode === 'explore' ? walkingRoute : null}
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
                  facility={search.facility}
                  onFacility={selectFacilityCategory}
                  onCategory={(category: Category | 'all') => {
                    setSheetSnap('half');
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        mode: 'explore',
                        place: undefined,
                        category: category === 'all' ? undefined : category,
                        facility: undefined,
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
                {search.mode === 'explore' && (
                  <>
                    {!plannerOpen ? (
                      <button
                        className="walking-submit"
                        onClick={() => {
                          setStationRouteSeed(null);
                          setPlannerOpen(true);
                          setSheetSnap('full');
                          document.querySelector('.panel-scroll')?.scrollTo({ top: 0 });
                        }}
                      >
                        Plan a walk
                      </button>
                    ) : (
                      <WalkingPlanner
                        origin={
                          stationRouteSeed?.role === 'start' ? stationRouteSeed.point : undefined
                        }
                        contextView={routeContext}
                        showHidden={routeShowHidden}
                        onShowHidden={setRouteShowHidden}
                        onContextView={(enabled) => {
                          setRouteContext(enabled);
                          if (mobile) setSheetSnap('peek');
                        }}
                        onPickMap={(select) => {
                          setRoutePicker({ select });
                          setRoutePickError('');
                          setSheetSnap('peek');
                        }}
                        onIndoorMap={showIndoorMap}
                        destination={
                          stationRouteSeed
                            ? stationRouteSeed.role === 'end'
                              ? stationRouteSeed.point
                              : undefined
                            : searchPin?.location
                              ? { ...searchPin.location, name: searchPin.name }
                              : selectedPlace
                                ? {
                                    lat: selectedPlace.lat,
                                    lng: selectedPlace.lng,
                                    name: selectedPlace.name,
                                  }
                                : undefined
                        }
                        onRoute={(route) => {
                          setWalkingRoute(route);
                          if (route && mobile) setSheetSnap('peek');
                        }}
                        onClose={() => {
                          setRoutePicker(null);
                          setPlannerOpen(false);
                          setWalkingRoute(null);
                        }}
                      />
                    )}
                  </>
                )}
                {mobile && windyActive && <div ref={setWindyControls} />}
                {mobile && showPlaceDetail && selectedPlace && (
                  <PlaceDetail
                    key={selectedPlace.id}
                    place={selectedPlace}
                    onClose={clearSelection}
                    onRoutePoint={planFromStation}
                    onTransit={() => setMode('transport')}
                  />
                )}
                {searchPin && search.mode === 'explore' && !plannerOpen && (
                  <SelectedSearchPlace
                    key={searchPin.id}
                    result={searchPin}
                    onClose={closeSearchPin}
                    onNearby={() => {
                      void navigate({
                        search: (previous) => ({
                          ...previous,
                          q: `nearby: ${searchPin.location!.lat}, ${searchPin.location!.lng}`,
                        }),
                      });
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
                {windyActive || (plannerOpen && search.mode === 'explore') ? null : search.mode ===
                  'explore' ? (
                  <ExplorePanel
                    facility={search.facility}
                    facilities={facilities}
                    onFacility={selectFacilityCategory}
                    onSearchSelect={selectSearchResult}
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
                          facility: undefined,
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
            </DiscoverySheet>
            {indoorMap && search.mode === 'explore' && (
              <section className="indoor-map-card" aria-label="Choose indoor point on map">
                <strong>
                  {indoorMap.stationName} · {indoorMap.levelName}
                </strong>
                <p>Selected level only · ground projection</p>
                <details className="indoor-map-legend">
                  <summary>Map legend &amp; access limits</summary>
                  <p>
                    {indoorMap.floor
                      ? 'Purple: floor boundary, not a walking path.'
                      : 'Floor outline unavailable.'}
                  </p>
                  {indoorMap.layout && indoorMap.floor && (
                    <p>
                      Grey: unit boundaries · teal: mapped openings, including service access.
                      Neither confirms public access or an open door.
                    </p>
                  )}
                </details>
                <label className="indoor-map-select">
                  Point on this level
                  <select
                    value={indoorCandidate?.id ?? ''}
                    onChange={(e) =>
                      setIndoorCandidate(
                        indoorMap.points.find((p) => p.id === e.target.value) ?? null,
                      )
                    }
                  >
                    <option value="">Tap a marker or choose a point</option>
                    {indoorMap.points.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        {i + 1}. {p.name} · {indoorCategoryLabels[p.category]}
                      </option>
                    ))}
                  </select>
                </label>
                {indoorCandidate && (
                  <>
                    <strong>
                      {indoorCandidate.name} · {indoorCandidate.nameZh}
                    </strong>
                    <p>
                      {indoorCategoryLabels[indoorCandidate.category]} · {indoorCandidate.levelName}{' '}
                      · {indoorCandidate.lat.toFixed(6)}, {indoorCandidate.lng.toFixed(6)}
                    </p>
                    {['elevator', 'stairs', 'escalator', 'ramp'].includes(
                      indoorCandidate.category,
                    ) && (
                      <p>
                        This is a transition point on the selected level. Connected levels and
                        current availability are not confirmed.
                      </p>
                    )}
                    <button
                      className="walking-submit"
                      onClick={() => {
                        indoorMap.select(indoorCandidate);
                        showIndoorMap(null);
                        setSheetSnap('full');
                      }}
                    >
                      Use this point
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    showIndoorMap(null);
                    setSheetSnap('full');
                  }}
                >
                  Back to point list
                </button>
              </section>
            )}

            {routePicker && search.mode === 'explore' && (
              <>
                <section className="route-pin-confirm" aria-label="Choose route point">
                  <strong>Drag the map to position the pin</strong>
                  <p>
                    {routePickError ||
                      'Choose a public entrance or pavement. This does not select a floor.'}
                  </p>
                  <button
                    className="walking-submit"
                    onClick={() => issueCommand('pick-route-point')}
                  >
                    Use this point
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setRoutePicker(null);
                      setSheetSnap('full');
                    }}
                  >
                    Cancel
                  </button>
                </section>
              </>
            )}
            {walkingRoute && !routePicker && !indoorMap && search.mode === 'explore' && (
              <button className="search-pin-preview" onClick={() => setSheetSnap('full')}>
                {routeContext ? '3D route · experimental' : 'Walking preview'} ·{' '}
                {Math.round(walkingRoute.distanceM)} m ·{' '}
                {Math.max(1, Math.round(walkingRoute.durationMinutes))} min · Directions ↑
              </button>
            )}

            {searchPin && search.mode === 'explore' && !plannerOpen && (
              <button className="search-pin-preview" onClick={() => setSheetSnap('half')}>
                {searchPin.name} · Details ↑
              </button>
            )}
            <div className="map-location">
              <span className="location-dot" />
              <span>HONG KONG SAR</span>
              <span className="coordinate-label">22.28° N · 114.16° E</span>
            </div>
            <div className="basemap-controls" aria-label="Map layers">
              <CityViewControl
                value={plannerOpen && search.mode === 'explore' ? routeContext : undefined}
                onChange={plannerOpen && search.mode === 'explore' ? setRouteContext : undefined}
              />
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
                    // iOS requires this request directly inside the user's tap gesture.
                    const orientation =
                      window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
                        requestPermission?: () => Promise<string>;
                      };
                    if (orientation?.requestPermission)
                      void orientation.requestPermission().catch(() => undefined);
                    setLocationMessage('Finding your location…');
                    navigator.geolocation.getCurrentPosition(
                      ({ coords }) => {
                        setCommand((previous) => ({
                          type: 'locate',
                          sequence: (previous?.sequence ?? 0) + 1,
                          location: {
                            lng: coords.longitude,
                            lat: coords.latitude,
                            accuracy: coords.accuracy,
                          },
                        }));
                        setSheetSnap('peek');
                        setLocationMessage(
                          `Location fix · accuracy about ${Math.round(coords.accuracy)} m. Direction appears when compass data is available.`,
                        );
                      },
                      () =>
                        setLocationMessage(
                          'Could not access location. Check location permission and use an HTTPS connection.',
                        ),
                      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true },
                    );
                  }}
                >
                  <LocateFixed size={21} />
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
                onRoutePoint={planFromStation}
                onTransit={() => setMode('transport')}
              />
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
