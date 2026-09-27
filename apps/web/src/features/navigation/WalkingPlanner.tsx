import { StationFloorPlan } from './StationFloorPlan';
import { RouteDirections } from './RouteDirections';
import type { IndoorMapChoice } from './indoor-map';
import { IndoorEndpointPicker } from './IndoorEndpointPicker';
import { RouteHeightProfile } from './RouteHeightProfile';
import { useEffect, useRef, useState } from 'react';
import {
  routeEndpointSchema,
  walkingRouteSchema,
  type RouteEndpoint,
  type RouteRequest,
  type WalkingRoute,
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
}: {
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
}) {
  const [start, setStart] = useState<RouteEndpoint | undefined>(origin);
  const [end, setEnd] = useState(destination);
  const [editing, setEditing] = useState<'start' | 'end'>(origin ? 'end' : 'start');
  const [query, setQuery] = useState('');
  const [indoorOpen, setIndoorOpen] = useState(false);
  const [profile, setProfile] = useState<RouteRequest['profile']>('recommended');
  const [language, setLanguage] = useState<RouteRequest['language']>('en');
  const [route, setRoute] = useState<WalkingRoute>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');
  const locationRequest = useRef(0);
  useEffect(
    () => () => {
      locationRequest.current++;
    },
    [],
  );
  function choosePoint(point: RouteEndpoint) {
    setLocationNote('');
    locationRequest.current++;
    setLocating(false);
    const validated = routeEndpointSchema.safeParse(point);
    if (!validated.success) {
      setError('Choose a point within Hong Kong.');
      return;
    }
    invalidate();
    if (editing === 'start') {
      setStart(point);
      setEditing('end');
    } else setEnd(point);
    setQuery('');
  }
  function useLocation() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setError('Current location requires HTTPS (or localhost) and browser location permission.');
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== locationRequest.current) return;
        choosePoint({ lat: coords.latitude, lng: coords.longitude, name: 'Current location' });
        setLocationNote(
          `GPS accuracy about ${Math.round(coords.accuracy)} m. Check your entrance; GPS cannot identify your floor.`,
        );
      },
      () => {
        if (request === locationRequest.current) {
          setLocating(false);
          setError('Location unavailable. Check permission, or choose a point on the map.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  function invalidate() {
    pending.current?.abort();
    setBusy(false);
    setRoute(undefined);
    onRoute(null);
    setError('');
  }
  async function plan() {
    if (!start || !end) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, profile, language }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(typeof data.error === 'string' ? data.error : 'Route unavailable.');
      const result = walkingRouteSchema.parse(data);
      if (controller.signal.aborted) return;
      setRoute(result);
      onRoute(result);
      setQuery('');
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Route unavailable.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="walking-planner" aria-label="Walking route planner">
      <div className="results-heading">
        <h2>Walking directions</h2>
        <button className="text-button" onClick={onClose}>
          Close directions
        </button>
      </div>
      <div className="endpoint-actions" aria-label="Navigation map view">
        <button
          aria-pressed={!contextView}
          onClick={() => {
            onContextView(false);
          }}
        >
          2D overview
        </button>
        <button
          aria-pressed={contextView}
          disabled={!import.meta.env.VITE_HK_3D_TILESET_URL}
          onClick={() => {
            onContextView(true);
          }}
        >
          3D · experimental
        </button>
      </div>
      {contextView && (
        <div className="floor-coverage-note">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(event) => onShowHidden(event.target.checked)}
            />
            Show hidden sections
          </label>
          {route?.paths.some((path) => path.some((point) => point[2] === null)) && (
            <p>
              Some sections have no source height and are omitted in 3D. Use 2D for the full route.
            </p>
          )}
        </div>
      )}
      <div className="walking-endpoints">
        <button
          aria-pressed={editing === 'start'}
          onClick={() => {
            locationRequest.current++;
            setLocating(false);
            setEditing('start');
            setQuery('');
          }}
        >
          <small>FROM</small>
          <strong>{start?.name ?? 'Choose a starting point'}</strong>
        </button>
        <button
          aria-pressed={editing === 'end'}
          onClick={() => {
            locationRequest.current++;
            setLocating(false);
            setEditing('end');
            setQuery('');
          }}
        >
          <small>TO</small>
          <strong>{end?.name ?? 'Choose a destination'}</strong>
        </button>
      </div>
      <div className="endpoint-actions" aria-label="Choose route endpoint">
        <button onClick={useLocation} disabled={locating}>
          {locating ? 'Finding location…' : 'Use current location'}
        </button>
        <button
          onClick={() => {
            locationRequest.current++;
            setLocating(false);
            setIndoorOpen(false);
            onIndoorMap(null);
            onPickMap(choosePoint);
          }}
        >
          Choose on map
        </button>
        <button
          disabled={!start && !end}
          onClick={() => {
            locationRequest.current++;
            setLocating(false);
            invalidate();
            setStart(end);
            setEnd(start);
          }}
        >
          Swap start and destination
        </button>
      </div>
      {locationNote && (
        <p className="search-notice" role="status">
          {locationNote}
        </p>
      )}
      <p className="search-notice">
        Choosing {editing === 'start' ? 'starting point' : 'destination'} · map pins use surface
        coordinates, not an indoor floor.
      </p>
      <button
        className="text-button"
        aria-expanded={indoorOpen}
        onClick={() => setIndoorOpen(!indoorOpen)}
      >
        {indoorOpen ? 'Hide station level picker' : 'Choose a station entrance or level'}
      </button>
      {indoorOpen && (
        <IndoorEndpointPicker
          onMap={onIndoorMap}
          key={editing}
          onSelect={(point) => {
            choosePoint(point);
            setIndoorOpen(false);
          }}
        />
      )}
      <label className="walking-search">
        Search {editing === 'start' ? 'starting point' : 'destination'}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Place, address or latitude, longitude"
        />
      </label>
      {query && (
        <SearchResults
          query={query}
          language={language === 'en' ? 'en' : 'tc'}
          onSelect={(row) => {
            if (!row.location) {
              setError('Choose a result with coordinates.');
              return;
            }
            choosePoint({ ...row.location, name: row.name });
          }}
        />
      )}
      <div className="walking-options">
        <label>
          Route preference
          <select
            value={profile}
            onChange={(e) => {
              invalidate();
              setProfile(e.target.value as RouteRequest['profile']);
            }}
          >
            <option value="recommended">Recommended</option>
            <option value="shortest">Shortest</option>
            <option value="barrier-free">Barrier-free</option>
          </select>
        </label>
        <label>
          Directions
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
      </div>
      <details className="route-indoor-details">
        <summary>Route information</summary>
        <p>
          Recommended favours indoor links and fewer stairs; it does not guarantee shelter.
          Barrier-free uses recorded restrictions, not live lift status.
        </p>
        <p>
          3D uses source heights, with limited checks in Admiralty. Indoor spaces are not part of
          the city model. Hidden sections appear dashed when enabled; dashes do not mean
          underground.
        </p>
        <p>
          Map picking uses 2D. Choose a station level for indoor endpoints; ordinary pins do not
          identify floors.
        </p>
      </details>
      <button
        className="walking-submit"
        disabled={!start || !end || busy}
        onClick={() => void plan()}
      >
        {busy ? 'Finding a walking route…' : 'Show walking route'}
      </button>
      {error && <p role="alert">{error}</p>}
      {route && (
        <article aria-label="Walking directions">
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
          {(route.request.start.indoor || route.request.end.indoor) && (
            <details className="route-indoor-details">
              <summary>View station floor plan</summary>
              {[route.request.start, route.request.end]
                .filter(
                  (point, index, all) =>
                    point.indoor &&
                    all.findIndex((other) => other.indoor?.venueId === point.indoor?.venueId) ===
                      index,
                )
                .map((point) => (
                  <StationFloorPlan key={point.indoor!.venueId} endpoint={point} />
                ))}
            </details>
          )}
          {!(route.request.start.indoor || route.request.end.indoor) && (
            <p className="floor-coverage-note">Choose a station endpoint to view its floor plan.</p>
          )}
          <RouteDirections route={route} />
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
