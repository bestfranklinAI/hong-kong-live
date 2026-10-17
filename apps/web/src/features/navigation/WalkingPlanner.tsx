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
import { useEffect, useRef, useState } from 'react';
import {
  routeEndpointSchema,
  walkingRouteSchema,
  type RouteEndpoint,
  type RouteRequest,
  type WalkingRoute,
  type StationRouteContext,
} from '@hk/contracts';
import { SearchResults } from '../search/SearchResults';
import './walking.css';

export function WalkingPlanner({
  showHidden,
  onShowHidden,
  contextView,
  onContextView,
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
}: {
  stationContexts?: StationRouteContext[];
  onInspectStation: (id: string) => void;
  stationLoading?: boolean;
  stationUnavailable?: boolean;
  onEndpointPreview: (point: RouteEndpoint, result?: import('@hk/contracts').SearchResult) => void;
  initialRoute?: WalkingRoute | null;
  showHidden: boolean;
  onShowHidden: (enabled: boolean) => void;
  contextView: boolean;
  onContextView: (enabled: boolean) => void;
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
  const [editing, setEditing] = useState<'start' | 'end' | null>(destination ? null : 'end');
  const [query, setQuery] = useState('');
  const [stationPicker, setStationPicker] = useState<{
    place: { name: string; nameZh: string };
    role: 'start' | 'end';
  } | null>(null);
  const startStation = !currentOrigin ? endpointStation(start) : null;
  const endStation = endpointStation(end);
  const [browseIndoor, setBrowseIndoor] = useState(false);
  const [profile, setProfile] = useState<RouteRequest['profile']>(
    initialRoute?.request.profile ?? 'recommended',
  );
  const [language, setLanguage] = useState<RouteRequest['language']>(
    initialRoute?.request.language ?? 'en',
  );
  const [route, setRoute] = useState<WalkingRoute | undefined>(initialRoute ?? undefined);
  const [destinationInfo, setDestinationInfo] = useState<import('@hk/contracts').SearchResult>();
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
  function invalidate() {
    revision.current++;
    pending.current?.abort();
    setBusy(false);
    setLocating(false);
    setRoute(undefined);
    onRoute(null);
    setError('');
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
  async function getLocation() {
    if (!navigator.geolocation || !window.isSecureContext)
      throw new Error(
        'Location needs HTTPS and browser permission. You can enter a starting point instead.',
      );
    return new Promise<RouteEndpoint>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const point = routeEndpointSchema.safeParse({
            lat: coords.latitude,
            lng: coords.longitude,
            name: 'Current location',
          });
          if (point.success) resolve(point.data);
          else reject(new Error('Your location is outside Hong Kong. Choose a starting point.'));
        },
        () =>
          reject(
            new Error('Location unavailable. Allow location access or enter a starting point.'),
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      ),
    );
  }
  async function plan() {
    if (!end) {
      setEditing('end');
      return;
    }
    invalidate();
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
        from = await getLocation();
      }
      if (request !== revision.current) return;
      setLocating(false);
      if (!from) throw new Error('Choose a starting point.');
      if (!currentOrigin && startStation && !from.indoor)
        from = { ...from, assumedConcourse: true };
      setStart(from);
      const response = await fetch('/api/v1/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: from, end, profile, language }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(typeof data.error === 'string' ? data.error : 'Route unavailable.');
      const result = walkingRouteSchema.parse(data);
      if (request !== revision.current || controller.signal.aborted) return;
      setRoute(result);
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
          <h2 className="sr-only">Directions</h2>
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
      {route && <StationRouteCards contexts={stationContexts} onInspect={onInspectStation} />}
      {route && stationLoading && (
        <p className="search-notice" role="status">
          Preparing station sections…
        </p>
      )}
      {route && stationUnavailable && (
        <p className="search-notice">Station detail unavailable. Follow the source directions.</p>
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
      <button className="text-button indoor-browse-launch" onClick={() => setBrowseIndoor(true)}>
        <Building2 size={20} />
        <span>Indoor maps</span>
        <ChevronRight size={18} />
      </button>
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
          {query ? (
            <SearchResults
              compact
              key={editing}
              query={query}
              language={language === 'en' ? 'en' : 'tc'}
              onSelect={(row) => {
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
      {!editing && (
        <div className="route-preferences" aria-label="Walking preference">
          {(
            [
              ['recommended', 'Recommended'],
              ['shortest', 'Shortest'],
              ['barrier-free', 'Step-free'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={profile === value}
              onClick={() => {
                invalidate();
                setProfile(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="route-toolbar">
        <button className="text-button" onClick={() => onContextView(!contextView)}>
          {contextView ? '3D view' : '2D view'}
        </button>
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
                invalidate();
                setLanguage(e.target.value as RouteRequest['language']);
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
            Step-free follows recorded restrictions, without live lift status. 3D uses source
            heights; indoor positioning is not available.
          </p>
        </details>
      </div>
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
          <h3>
            {Math.round(route.distanceM)} m · about {Math.max(1, Math.round(route.durationMinutes))}{' '}
            min
          </h3>
          {(route.endpointOffsetsM[0] > 5 || route.endpointOffsetsM[1] > 5) && (
            <p className="search-notice">
              Unrouted connection: {Math.round(route.endpointOffsetsM[0])} m at start ·{' '}
              {Math.round(route.endpointOffsetsM[1])} m at destination.
            </p>
          )}
          <details className="route-indoor-details">
            <summary>Step-by-step directions</summary>
            <RouteDirections route={route} />
          </details>
          <details>
            <summary>Inspect source height profile</summary>
            <RouteHeightProfile key={route.fetchedAt} route={route} />
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
            <a href={route.sourceUrl} target="_blank" rel="noreferrer">
              Lands Department route service ↗
            </a>
          </details>
        </article>
      )}
    </section>
  );
}
