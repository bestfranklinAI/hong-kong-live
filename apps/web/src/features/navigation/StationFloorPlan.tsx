import { classifyVenueRoute } from './venue-route-match';
import { routeExit } from './route-exit';
import { StationFloorInstructions } from './StationFloorInstructions';
import { StationRouteJourney } from './StationRouteJourney';
import { floorRoutePaths, floorRouteChanges } from './station-route-geometry';
import { RouteDirections } from './RouteDirections';
import { floorRouteCamera } from './floor-drawing';
import { useMemo, useState, type ReactNode } from 'react';
import { Maximize2, MoreHorizontal, X } from 'lucide-react';
import { IndoorMapCanvas } from './IndoorMapCanvas';
import { FloorDiagram } from './FloorDiagram';
import { useQuery } from '@tanstack/react-query';
import {
  indoorFloorsSchema,
  indoorPointsSchema,
  indoorLayoutSchema,
  type RouteEndpoint,
  type WalkingRoute,
  type StationRouteContext,
} from '@hk/contracts';
import { getJson } from '../live/queries';
import { NavigationIcon } from './NavigationIcon';

/** Separate plan: floor geometry is not draped onto an exterior city mesh. */
export function StationFloorPlan({
  endpoint,
  station,
  onRoutePoint,
  kind = 'station',
  onDismiss,
  stationRoute: providedStationRoute,
  routeRole,
  onContinueRoute,
  journeyViews,
  routeForVenue,
  initialLevel,
  onLevelChange,
  journeyGuidance,
}: {
  journeyGuidance?: (floorId: string) => ReactNode;
  routeForVenue?: WalkingRoute;
  initialLevel?: string;
  onLevelChange?: (id: string) => void;
  journeyViews?: ReactNode;
  onContinueRoute?: () => void;
  routeRole?: 'start' | 'end';
  stationRoute?: { route: WalkingRoute; context: StationRouteContext };
  kind?: 'station' | 'building';
  onDismiss?: () => void;
  endpoint?: RouteEndpoint;
  station?: { id: string; name: string };
  onRoutePoint?: (point: RouteEndpoint, role: 'start' | 'end') => void;
}) {
  const venue = station?.id ?? endpoint!.indoor!.venueId;
  const [expanded, setExpanded] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const base = `/api/v1/routes/indoor/${kind === 'station' ? 'stations' : 'buildings'}/${venue}`;
  const [level, setLevel] = useState(initialLevel ?? '');
  const chooseLevel = (id: string) => {
    setLevel(id);
    setSelected('');
    onLevelChange?.(id);
  };
  const [selected, setSelected] = useState('');
  const floors = useQuery({
    queryKey: ['indoor-floors', venue, kind],
    queryFn: async ({ signal }) =>
      indoorFloorsSchema.parse(await getJson(`${base}/floors`, signal)),
    staleTime: 21600000,
    retry: 1,
  });
  const stationRoute = useMemo(() => {
    if (providedStationRoute) return providedStationRoute;
    if (!routeForVenue || !floors.data || !station) return undefined;
    const segments = classifyVenueRoute(routeForVenue, floors.data.floors, {
      ...station,
      nameZh: '',
      kind,
    });
    if (!segments.length) return undefined;
    return {
      route: routeForVenue,
      context: {
        venue: { ...station, nameZh: '', kind },
        floors: floors.data.floors,
        segments,
        endpointRoles: [],
      } as StationRouteContext,
    };
  }, [providedStationRoute, routeForVenue, floors.data, station, venue, kind]);
  const points = useQuery({
    queryKey: ['indoor-points', venue, kind],
    queryFn: async ({ signal }) =>
      indoorPointsSchema.parse(await getJson(`${base}/points`, signal)),
    staleTime: 21600000,
    retry: 1,
  });
  const layout = useQuery({
    queryKey: ['indoor-layout', venue, kind],
    queryFn: async ({ signal }) =>
      indoorLayoutSchema.parse(await getJson(`${base}/layout`, signal)),
    staleTime: 21600000,
    retry: 1,
  });
  const endpointPoint = points.data?.points.find((p) => p.id === endpoint?.indoor?.pointId);
  const defaultFloor =
    floors.data?.floors.find((f) =>
      kind === 'station'
        ? /\bconcourse\b/i.test(f.name)
        : /^(?:G|G[F/]*|Ground(?: Floor| Level)?)$/i.test(f.name),
    ) ?? floors.data?.floors[0];
  const floor = floors.data?.floors.find(
    (f) =>
      f.id ===
      (level ||
        stationRoute?.context.segments.find((segment) => segment.levelId)?.levelId ||
        endpointPoint?.levelId ||
        defaultFloor?.id),
  );
  const rows = points.data?.points.filter((p) => p.levelId === floor?.id) ?? [];
  const active = rows.find((p) => p.id === selected);
  const sourceRoute = stationRoute?.route;
  const stationSegments = stationRoute?.context.segments;
  const routePaths = useMemo(
    () =>
      floor && sourceRoute && stationSegments
        ? floorRoutePaths(sourceRoute, stationSegments, floor.id)
        : [],
    [floor, sourceRoute, stationSegments],
  );
  const routeView = useMemo(
    () =>
      floor
        ? floorRouteCamera(
            floor,
            points.data?.points.filter((point) => point.levelId === floor.id) ?? [],
            routePaths,
          )
        : undefined,
    [floor, points.data, routePaths],
  );

  const sorted = [...(floors.data?.floors ?? [])].sort((a, b) => b.z - a.z);
  return (
    <section
      className={`station-floor-plan${stationRoute ? ' indoor-route-plan' : ''}${expanded ? ' indoor-plan-expanded' : ''}`}
      aria-label="Indoor floor plan"
    >
      <div className="indoor-plan-heading">
        <h3>{expanded ? (station?.name ?? endpoint?.name ?? 'Floor plan') : 'Floor plan'}</h3>
        {expanded && onDismiss && (
          <button className="icon-button" aria-label="Close indoor map" onClick={onDismiss}>
            <X size={20} />
          </button>
        )}
        <button
          className="icon-button"
          aria-label={expanded ? 'Indoor map options' : 'Expand indoor map'}
          aria-expanded={expanded ? optionsOpen : undefined}
          onClick={() => (expanded ? setOptionsOpen(!optionsOpen) : setExpanded(true))}
        >
          {expanded ? <MoreHorizontal size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>
      {expanded && optionsOpen && (
        <aside className="indoor-options-panel" aria-label="Indoor map options">
          <p>
            Pinch to zoom · twist with two fingers to rotate. Compass aligns the plan to your
            direction; it does not locate your floor.
          </p>
          {stationRoute && floor && (
            <>
              <StationFloorInstructions
                route={stationRoute.route}
                venue={stationRoute.context.venue}
                floor={floor}
              />
              <details>
                <summary>Full trip directions</summary>
                <RouteDirections route={stationRoute.route} />
              </details>
            </>
          )}
          <p>
            Source: Lands Department. Route floors use source heights and floor boundaries. Some
            connectors remain unassigned. Follow station signs and check access locally.
          </p>
          <button className="text-button" onClick={() => setOptionsOpen(false)}>
            Back to map
          </button>
        </aside>
      )}
      {(floors.isPending || points.isPending) && <p role="status">Loading floor plan…</p>}
      {(floors.isError || points.isError) && (
        <p role="alert">
          Indoor plan unavailable. Please retry.{' '}
          <button
            className="text-button"
            onClick={() => {
              void floors.refetch();
              void points.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      {journeyViews}
      <label className="indoor-floor-select">
        <span className="sr-only">Floor</span>
        <select
          value={floor?.id ?? ''}
          onChange={(e) => {
            chooseLevel(e.target.value);
          }}
        >
          <option value="">Choose a level</option>
          {sorted.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.nameZh ? ` · ${f.nameZh}` : ''}
            </option>
          ))}
        </select>
      </label>
      {stationRoute?.context.segments.some(
        (segment) => segment.levelId === floor?.id && segment.match === 'direction-level',
      ) && <small className="indoor-level-match-note">2D floor match · source directions</small>}
      {floor && (
        <>
          <IndoorMapCanvas
            key={floor.id}
            initialView={routeView}
            initialRotation={rotation}
            onRotationChange={setRotation}
            overlay={
              stationRoute && !journeyGuidance ? (
                <StationFloorInstructions
                  compact
                  route={stationRoute.route}
                  venue={stationRoute.context.venue}
                  floor={floor}
                />
              ) : undefined
            }
          >
            {(zoom, focus, rotation) => (
              <FloorDiagram
                floor={floor}
                points={rows}
                layout={layout.data}
                selected={selected}
                onSelect={setSelected}
                zoom={zoom}
                rotation={rotation}
                onZoom={focus}
                routePaths={routePaths}
                recommendedExitId={
                  stationRoute
                    ? routeExit(stationRoute.route, stationRoute.context, points.data?.points ?? [])
                        ?.id
                    : undefined
                }
                levelChanges={
                  stationRoute
                    ? floorRouteChanges(stationRoute.route, stationRoute.context.segments, floor)
                    : undefined
                }
              />
            )}
          </IndoorMapCanvas>
          {stationRoute && journeyGuidance && journeyGuidance(floor.id)}
          {stationRoute && !journeyGuidance && (
            <StationRouteJourney
              context={stationRoute.context}
              route={stationRoute.route}
              level={floor?.id ?? ''}
              onLevel={(id) => {
                chooseLevel(id);
              }}
              onContinue={onContinueRoute ?? onDismiss}
            />
          )}

          {stationRoute && (
            <details className="station-route-details">
              <summary>Directions on this floor</summary>
              <StationFloorInstructions
                route={stationRoute.route}
                venue={stationRoute.context.venue}
                floor={floor}
              />
            </details>
          )}
          {stationRoute && routePaths.length === 0 && (
            <p className="search-notice">No route segment is uniquely matched to this floor.</p>
          )}
          {active && (
            <p className="floor-point-detail">
              <NavigationIcon kind={active.category} />
              <strong>{active.name}</strong> · {active.levelName}
            </p>
          )}
          {active && onRoutePoint && kind === 'station' && (
            <div className="endpoint-actions">
              {(routeRole ? [routeRole] : (['start', 'end'] as const)).map((role) => (
                <button
                  key={role}
                  onClick={() =>
                    onRoutePoint(
                      {
                        name: `${station?.name ?? endpoint?.name} · ${active.levelName} · ${active.name}`,
                        lat: active.lat,
                        lng: active.lng,
                        z: active.z,
                        indoor: { venueId: venue, pointId: active.id },
                      },
                      role,
                    )
                  }
                >
                  {role === 'start' ? 'Start here' : 'Directions here'}
                </button>
              ))}
            </div>
          )}
          {points.isSuccess && rows.length === 0 && <p>No mapped amenities on this floor.</p>}
        </>
      )}
      {routeForVenue && floors.isSuccess && !stationRoute && (
        <p className="search-notice">
          The route could not be matched to this building's supplied floors. Choose a level or check
          city directions.
        </p>
      )}
      {floors.data?.floors.length === 0 && <p>No floor plan is available for this venue.</p>}
      {layout.isPending && <p className="search-notice">Loading interior boundaries…</p>}
      {layout.isError && (
        <p className="search-notice">
          Interior boundaries unavailable; the floor outline remains available.
        </p>
      )}
      {stationRoute && (
        <details className="route-indoor-details station-route-details">
          <summary>Trip directions</summary>
          {stationRoute.context.segments.some((segment) => segment.kind === 'unassigned') && (
            <p className="search-notice">
              Some connectors have no unique floor assignment. These are not drawn as a confirmed
              route on a floor.
            </p>
          )}
          <RouteDirections route={stationRoute.route} />
        </details>
      )}
      <details className="route-indoor-details">
        <summary>Map key & coverage</summary>
        <p>
          Rotate with two fingers · purple outline · grey boundaries · teal openings. Boundaries do
          not identify public walking space. Route-to-floor matching uses full segment containment
          and source Z; ambiguous connectors remain unassigned. It is not a surveyed alignment or
          live floor detection.
        </p>
        <p className="floor-coverage-note">
          A floor outline does not establish public walking access. Follow the source directions for
          level changes; connected lift levels and current availability are unconfirmed.
        </p>
      </details>
      <small>Source: Lands Department · source update time unavailable.</small>
    </section>
  );
}
