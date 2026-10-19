import {
  Building2,
  ChevronRight,
  ArrowDownUp,
  ArrowLeft,
  LocateFixed,
  MapPin,
  Navigation,
  Settings2,
  X,
} from 'lucide-react';
import { StationIndoorDialog } from './StationIndoorDialog';
import { StationStartChoice } from './StationStartChoice';
import { StationRouteCards } from './StationRouteCards';
import { endpointStation } from './station-endpoint';
import { RouteDirections } from './RouteDirections';
import type { IndoorMapChoice } from './indoor-map';
import { RouteHeightProfile } from './RouteHeightProfile';
import { requestWalkingLocation } from './walking-location';
import { RouteComparison } from './RouteComparison';
import { useRouteComparison } from './use-route-comparison';
import { requestWalkingRoute } from './request-walking-route';
import { walkingProfiles } from './route-comparison';
import { usePreferences } from '../../app/preferences';
import { useEffect, useRef, useState } from 'react';
import {
  routeEndpointSchema,
  type RouteEndpoint,
  type RouteRequest,
  type WalkingRoute,
  type StationRouteContext,
  type DiscoveryIntent,
} from '@hk/contracts';
import { SearchResults } from '../search/SearchResults';
import './walking.css';

export function WalkingPlanner({
  showHidden,
  onShowHidden,
  onPickMap,
  onIndoorMap,
  destination,
  origin,
  onRoute,
  onClose,
  onStart,
  initialRoute,
  onEndpointPreview,
  stationContexts = [],
  onInspectStation,
  stationLoading = false,
  stationUnavailable = false,
  onExpandComparison,
}: {
  onExpandComparison?: () => void;
  stationContexts?: StationRouteContext[];
  onInspectStation: (id: string) => void;
  stationLoading?: boolean;
  stationUnavailable?: boolean;
  onEndpointPreview: (point: RouteEndpoint, result?: import('@hk/contracts').SearchResult) => void;
  initialRoute?: WalkingRoute | null;
  showHidden: boolean;
  onShowHidden: (enabled: boolean) => void;
  onPickMap: (select: (point: RouteEndpoint) => void) => void;
  onIndoorMap: (choice: IndoorMapChoice | null) => void;
  destination?: RouteEndpoint;
  origin?: RouteEndpoint;
  onRoute: (route: WalkingRoute | null) => void;
  onClose: () => void;
  onStart: (route: WalkingRoute) => void;
}) {
  const [start, setStart] = useState<RouteEndpoint | undefined>(origin);
  const [end, setEnd] = useState(destination);
  const [currentOrigin, setCurrentOrigin] = useState(!origin || origin.name === 'Current location');
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);
  const [query, setQuery] = useState('');
  const [stationPicker, setStationPicker] = useState<{
    place: { name: string; nameZh: string };
    role: 'start' | 'end';
  } | null>(null);
  const startStation = !currentOrigin ? endpointStation(start) : null;
  const endStation = endpointStation(end);
  const [browseIndoor, setBrowseIndoor] = useState(false);
  const [profile, setProfile] = useState<RouteRequest['profile']>(
    initialRoute?.request.profile ?? usePreferences.getState().walkingProfile,
  );
  const [language, setLanguage] = useState<RouteRequest['language']>(
    initialRoute?.request.language ?? usePreferences.getState().directionsLanguage,
  );
  const [route, setRoute] = useState<WalkingRoute | undefined>(initialRoute ?? undefined);
  const comparison = useRouteComparison(initialRoute ?? undefined);
  const [destinationInfo, setDestinationInfo] = useState<import('@hk/contracts').SearchResult>();
  const [discoveryPreference, setDiscoveryPreference] = useState<DiscoveryIntent | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
      pending.current?.abort();
    },
    [],
  );
  function invalidate(clearDiscovery = true) {
    revision.current++;
    pending.current?.abort();
    setBusy(false);
    setLocating(false);
    setRoute(undefined);
    comparison.reset();
    onRoute(null);
    setError('');
    if (clearDiscovery) setDiscoveryPreference(null);
  }
  function choosePoint(point: RouteEndpoint, result?: import('@hk/contracts').SearchResult) {
    const validated = routeEndpointSchema.safeParse(point);
    if (!validated.success) {
      setError('Choose a point within Hong Kong.');
      return;
    }
    invalidate();
    if (editing === 'start') {
      setStart(point);
      setCurrentOrigin(false);
    } else {
      setEnd(point);
      setDestinationInfo(undefined);
      onEndpointPreview(point, result);
    }
    setEditing(null);
    setQuery('');
    onIndoorMap(null);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  async function getLocation(signal?: AbortSignal) {
    if (!navigator.geolocation || !window.isSecureContext)
      throw new Error(
        'Location needs HTTPS and browser permission. You can enter a starting point instead.',
      );
    const controller = signal ? undefined : new AbortController();
    if (controller) pending.current = controller;
    const fix = await requestWalkingLocation(navigator.geolocation, signal ?? controller?.signal);
    const point = routeEndpointSchema.safeParse({ ...fix, name: 'Current location' });
    if (!point.success)
      throw new Error('Your location is outside Hong Kong. Choose a starting point.');
    return point.data;
  }
  async function plan() {
    if (!end) {
      setEditing('end');
      return;
    }
    invalidate(false);
    const request = revision.current;
    setBusy(true);
    setEditing(null);
    setQuery('');
    const controller = new AbortController();
    pending.current = controller;
    try {
      let from = start;
      if (currentOrigin) {
        setLocating(true);
        from = await getLocation(controller.signal);
      }
      if (request !== revision.current) return;
      setLocating(false);
      if (!from) throw new Error('Choose a starting point.');
      if (!currentOrigin && startStation && !from.indoor)
        from = { ...from, assumedConcourse: true };
      setStart(from);
      const result = await requestWalkingRoute(
        { start: from, end, profile, language },
        controller.signal,
      );
      if (request !== revision.current || controller.signal.aborted) return;
      setRoute(result);
      comparison.reset(result);
      onRoute(result);
    } catch (err) {
      if (request === revision.current && !controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Route unavailable.');
    } finally {
      if (request === revision.current) {
        setBusy(false);
        setLocating(false);
      }
    }
  }
  return (
    <section className="walking-planner navigation-planner" aria-label="Walking route planner">
      {route ? (
        <div className="navigation-route-actions">
          <div className="route-preview-heading">
            <small>Walking route</small>
            <h2>{route.request.end.name}</h2>
            <p>
              <strong>{Math.max(1, Math.round(route.durationMinutes))} min</strong> ·{' '}
              {Math.round(route.distanceM)} m
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close directions">
            <ArrowLeft size={20} />
          </button>
          <button className="walking-submit navigation-start" onClick={() => onStart(route)}>
            <Navigation size={20} />
            Start walking
          </button>
        </div>
      ) : (
        <div className="navigation-title">
          <button className="icon-button" onClick={onClose} aria-label="Close directions">
            <ArrowLeft size={20} />
          </button>
          <h2>Walking route</h2>
        </div>
      )}
      {route && (
        <RouteComparison
          comparison={comparison}
          selected={route}
          onExpand={onExpandComparison}
          onSelect={(choice) => {
            if (choice === route) return;
            setRoute(choice);
            setProfile(choice.request.profile);
            usePreferences.getState().setWalkingProfile(choice.request.profile);
            onRoute(choice);
          }}
        />
      )}
      {stationPicker && (
        <StationIndoorDialog
          place={stationPicker.place}
          routeRole={stationPicker.role}
          open
          onClose={() => setStationPicker(null)}
          onRoutePoint={(point, role) => {
            invalidate();
            if (role === 'start') {
              setStart(point);
              setCurrentOrigin(false);
            } else {
              setEnd(point);
              onEndpointPreview(point);
            }
            setEditing(null);
            setStationPicker(null);
          }}
        />
      )}
      <details className="route-edit" data-has-route={Boolean(route)} open={!route || undefined}>
        <summary>{route ? 'Edit journey' : 'Start & destination'}</summary>
        <div className="route-fields">
          <div className="route-field-stack">
            {(['start', 'end'] as const).map((role) => (
              <label key={role} className={`route-field ${editing === role ? 'editing' : ''}`}>
                {role === 'start' ? <LocateFixed size={18} /> : <MapPin size={18} />}
                <span>
                  <small>{role === 'start' ? 'From' : 'To'}</small>
                  <input
                    aria-label={role === 'start' ? 'Starting point' : 'Destination'}
                    placeholder="Place, link or coordinates"
                    value={
                      editing === role
                        ? query
                        : role === 'start' && currentOrigin
                          ? 'Current location'
                          : ((role === 'start' ? start?.name : end?.name) ?? '')
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' || (event.key === 'Enter' && query.trim())) {
                        const result = event.currentTarget
                          .closest('section')
                          ?.querySelector<HTMLButtonElement>('.search-result');
                        if (result) {
                          event.preventDefault();
                          if (event.key === 'Enter') result.click();
                          else result.focus();
                        }
                      }
                    }}
                    autoComplete="off"
                    autoFocus={
                      role === 'end' &&
                      !destination &&
                      window.matchMedia('(min-width: 701px)').matches
                    }
                    onFocus={(event) => {
                      setEditing(role);
                      setQuery('');
                      onIndoorMap(null);
                      event.currentTarget.select();
                    }}
                    onChange={(event) => {
                      invalidate();
                      setQuery(event.target.value);
                      if (role === 'start') {
                        setStart(undefined);
                        setCurrentOrigin(false);
                      } else setEnd(undefined);
                    }}
                  />
                </span>
                {editing === role && query && (
                  <button
                    className="icon-button"
                    aria-label="Clear endpoint search"
                    type="button"
                    onClick={() => setQuery('')}
                  >
                    <X size={16} />
                  </button>
                )}
              </label>
            ))}
          </div>
          <button
            className="icon-button route-swap"
            aria-label="Swap start and destination"
            disabled={!start || !end}
            onClick={() => {
              invalidate();
              setStart(end);
              setEnd(start);
              setCurrentOrigin(false);
              setEditing(null);
              setQuery('');
            }}
          >
            <ArrowDownUp size={18} />
          </button>
        </div>
        {editing && (
          <div className="endpoint-search-panel">
            {query && editing === 'end' && currentOrigin && !start && (
              <button
                className="text-button"
                disabled={locating}
                onClick={() => {
                  invalidate();
                  const request = revision.current;
                  setLocating(true);
                  void getLocation()
                    .then((point) => {
                      if (request === revision.current) setStart(point);
                    })
                    .catch((err: Error) => {
                      if (request === revision.current) setError(err.message);
                    })
                    .finally(() => {
                      if (request === revision.current) setLocating(false);
                    });
                }}
              >
                {locating ? 'Finding your location…' : 'Use current location for nearby search'}
              </button>
            )}
            {query ? (
              <SearchResults
                compact
                key={editing}
                query={query}
                language={language === 'en' ? 'en' : 'tc'}
                selectionPurpose={editing}
                discoveryCenter={start ? { lat: start.lat, lng: start.lng } : undefined}
                onSelect={(row, intent) => {
                  if (!row.location) {
                    setError('Choose a result with a mapped location.');
                    return;
                  }
                  choosePoint(
                    {
                      ...row.location,
                      name: row.sharedPlace?.name ?? row.name,
                      ...(row.station ? { station: row.station } : {}),
                    },
                    row,
                  );
                  if (editing === 'end') setDestinationInfo(row);
                  if (intent) setDiscoveryPreference(intent);
                }}
              />
            ) : (
              <div className="endpoint-shortcuts">
                <button
                  onClick={() => {
                    invalidate();
                    if (editing === 'start') {
                      setCurrentOrigin(true);
                      setStart(undefined);
                      setEditing(null);
                    } else {
                      const request = revision.current;
                      setLocating(true);
                      void getLocation()
                        .then((point) => {
                          if (request === revision.current) choosePoint(point);
                        })
                        .catch((err: Error) => {
                          if (request === revision.current) setError(err.message);
                        })
                        .finally(() => {
                          if (request === revision.current) setLocating(false);
                        });
                    }
                  }}
                >
                  <LocateFixed size={18} />
                  Current location
                </button>
                <button
                  onClick={() => {
                    onIndoorMap(null);
                    onPickMap(choosePoint);
                  }}
                >
                  <MapPin size={18} />
                  Choose on map
                </button>
              </div>
            )}
          </div>
        )}
        {startStation && (
          <StationStartChoice
            station={startStation}
            route={route}
            onChoose={() => setStationPicker({ place: startStation, role: 'start' })}
            onCurrent={() => {
              invalidate();
              setStart(undefined);
              setCurrentOrigin(true);
              setEditing(null);
            }}
          />
        )}
        {endStation && (
          <details className="station-destination-choice">
            <summary>{endStation.name} · reference destination</summary>
            <button
              className="text-button"
              onClick={() => setStationPicker({ place: endStation, role: 'end' })}
            >
              Choose destination entrance or floor
            </button>
          </details>
        )}
        {!editing && end && destinationInfo && (
          <div className="destination-summary">
            <span>{destinationInfo.address}</span>
            {destinationInfo.sharedPlace && (
              <>
                <small>Building reference · floor and entrance unverified</small>
                <details>
                  <summary>Place details</summary>
                  <p>{destinationInfo.sharedPlace.address}</p>
                  <a href={destinationInfo.sharedPlace.url} target="_blank" rel="noreferrer">
                    Open in Google Maps ↗
                  </a>
                </details>
              </>
            )}
          </div>
        )}
        {discoveryPreference && discoveryPreference.mobility !== 'walking' && (
          <p className="comparison-note">
            You requested{' '}
            {discoveryPreference.mobility === 'fewer-stairs'
              ? 'fewer stairs'
              : 'barrier-free access'}
            . Choose and compare the official route profiles; this request does not verify
            accessibility or lift operation.
          </p>
        )}
        {!editing && !route && (
          <div className="route-preferences" aria-label="Walking preference">
            {walkingProfiles.map(({ id: value, label }) => (
              <button
                key={value}
                aria-pressed={profile === value}
                onClick={() => {
                  invalidate(false);
                  setProfile(value);
                  usePreferences.getState().setWalkingProfile(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!editing && !route && profile === 'barrier-free' && (
          <p className="comparison-note">
            Government profile · current access and lift operation unverified.
          </p>
        )}
        <div className="route-toolbar">
          <details className="route-options">
            <summary>
              <Settings2 size={16} />
              Options
            </summary>
            <label>
              Directions language
              <select
                value={language}
                onChange={(e) => {
                  invalidate(false);
                  setLanguage(e.target.value as RouteRequest['language']);
                  usePreferences
                    .getState()
                    .setDirectionsLanguage(e.target.value as RouteRequest['language']);
                }}
              >
                <option value="en">English</option>
                <option value="zh-HK">繁體中文</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => onShowHidden(e.target.checked)}
              />
              Show obscured route
            </label>
            <p>
              Barrier-free follows recorded restrictions, without live lift status. 3D uses source
              heights; indoor positioning is not available.
            </p>
          </details>
        </div>
        {browseIndoor && (
          <StationIndoorDialog
            open
            onClose={() => setBrowseIndoor(false)}
            onRoutePoint={(point, role) => {
              invalidate();
              if (role === 'start') {
                setStart(point);
                setCurrentOrigin(false);
              } else {
                setEnd(point);
                onEndpointPreview(point);
              }
              setEditing(null);
              setBrowseIndoor(false);
            }}
          />
        )}
      </details>
      {error && (
        <p className="navigation-error" role="alert">
          {error}
        </p>
      )}
      {!route && (
        <button
          className="walking-submit"
          disabled={!end || (!currentOrigin && !start) || busy}
          onClick={() => void plan()}
        >
          {locating ? 'Finding your location…' : busy ? 'Finding route…' : 'Find walking route'}
        </button>
      )}
      {route && (
        <article className="route-result" aria-label="Walking directions">
          {route && <StationRouteCards contexts={stationContexts} onInspect={onInspectStation} />}
          {route && stationLoading && (
            <p className="search-notice" role="status">
              Preparing station sections…
            </p>
          )}
          {route && stationUnavailable && (
            <p className="search-notice">
              Station detail unavailable. Follow the source directions.
            </p>
          )}

          {(route.endpointOffsetsM[0] > 5 || route.endpointOffsetsM[1] > 5) && (
            <p className="search-notice">
              Unrouted connection: {Math.round(route.endpointOffsetsM[0])} m at start ·{' '}
              {Math.round(route.endpointOffsetsM[1])} m at destination.
            </p>
          )}
          <details className="route-indoor-details">
            <summary>All directions · {route.steps.length} steps</summary>
            <RouteDirections route={route} />
          </details>
          <details>
            <summary>Source & accuracy</summary>{' '}
            <p>Source estimate; lift waiting time and current conditions may differ.</p>
            <p className="search-notice">
              The 2D overview projects all sections onto a flat map; 3D uses supplied elevations.
              Confirm the entrance and level using the directions.
            </p>
            <p className="search-provenance">
              Network connection offsets: start {Math.round(route.endpointOffsetsM[0])} m ·
              destination {Math.round(route.endpointOffsetsM[1])} m. These gaps are not routed.
            </p>
            {route.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
            <p>
              Fetched {new Date(route.fetchedAt).toLocaleString()} · source update time unavailable.
            </p>
            <details>
              <summary>Height profile</summary>
              <RouteHeightProfile key={route.fetchedAt} route={route} />
            </details>
            <a href={route.sourceUrl} target="_blank" rel="noreferrer">
              Lands Department route service ↗
            </a>
          </details>
        </article>
      )}
      <button className="text-button indoor-browse-launch" onClick={() => setBrowseIndoor(true)}>
        <Building2 size={20} />
        <span>Indoor maps</span>
        <ChevronRight size={18} />
      </button>
    </section>
  );
}
