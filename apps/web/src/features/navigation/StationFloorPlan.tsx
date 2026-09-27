import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  indoorFloorsSchema,
  indoorPointsSchema,
  indoorLayoutSchema,
  type RouteEndpoint,
  type IndoorFloor,
} from '@hk/contracts';
import { getJson } from '../live/queries';
import { NavigationIcon } from './NavigationIcon';
import { indoorCategoryLabels } from './indoor-map';

/** Separate plan: floor geometry is not draped onto an exterior city mesh. */
export function StationFloorPlan({
  endpoint,
  station,
  onRoutePoint,
}: {
  endpoint?: RouteEndpoint;
  station?: { id: string; name: string };
  onRoutePoint?: (point: RouteEndpoint, role: 'start' | 'end') => void;
}) {
  const venue = station?.id ?? endpoint!.indoor!.venueId;
  const [level, setLevel] = useState('');
  const [selected, setSelected] = useState('');
  const floors = useQuery({
    queryKey: ['indoor-floors', venue],
    queryFn: async ({ signal }) =>
      indoorFloorsSchema.parse(
        await getJson(`/api/v1/routes/indoor/stations/${venue}/floors`, signal),
      ),
    staleTime: 21600000,
    retry: 1,
  });
  const points = useQuery({
    queryKey: ['indoor-points', venue],
    queryFn: async ({ signal }) =>
      indoorPointsSchema.parse(
        await getJson(`/api/v1/routes/indoor/stations/${venue}/points`, signal),
      ),
    staleTime: 21600000,
    retry: 1,
  });
  const layout = useQuery({
    queryKey: ['indoor-layout', venue],
    queryFn: async ({ signal }) =>
      indoorLayoutSchema.parse(
        await getJson(`/api/v1/routes/indoor/stations/${venue}/layout`, signal),
      ),
    staleTime: 21600000,
    retry: 1,
  });
  const endpointPoint = points.data?.points.find((p) => p.id === endpoint?.indoor?.pointId);
  const defaultFloor =
    floors.data?.floors.find((f) => /^concourse level$/i.test(f.name)) ?? floors.data?.floors[0];
  const floor = floors.data?.floors.find(
    (f) => f.id === (level || endpointPoint?.levelId || defaultFloor?.id),
  );
  const rows = points.data?.points.filter((p) => p.levelId === floor?.id) ?? [];
  const active = rows.find((p) => p.id === selected);
  const sorted = [...(floors.data?.floors ?? [])].sort((a, b) => b.z - a.z);
  return (
    <section className="station-floor-plan" aria-label="Station floor plan">
      <h3>Floor plan</h3>
      <p className="search-notice">{station?.name ?? endpoint?.name}</p>
      {(floors.isPending || points.isPending) && (
        <p role="status">Loading official station floors…</p>
      )}
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
      <label>
        Station level
        <select
          value={floor?.id ?? ''}
          onChange={(e) => {
            setLevel(e.target.value);
            setSelected('');
          }}
        >
          <option value="">Choose a level</option>
          {sorted.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} · {f.nameZh}
            </option>
          ))}
        </select>
      </label>
      {floor && (
        <>
          <FloorDiagram
            floor={floor}
            points={rows}
            layout={layout.data}
            selected={selected}
            onSelect={setSelected}
          />
          <label>
            Point on this floor
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Inspect a lift, stair or entrance</option>
              {rows.map((p, i) => (
                <option key={p.id} value={p.id}>
                  {i + 1}. {p.name} · {indoorCategoryLabels[p.category]}
                </option>
              ))}
            </select>
          </label>
          {active && (
            <p className="floor-point-detail">
              <NavigationIcon kind={active.category} />
              <strong>{active.name}</strong> · {active.levelName}
            </p>
          )}
          {active && onRoutePoint && (
            <div className="endpoint-actions">
              {(['start', 'end'] as const).map((role) => (
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
          {rows.length === 0 && <p>No mapped routing points on this floor.</p>}
        </>
      )}
      {floors.data?.floors.length === 0 && <p>No floor plan is available for this station.</p>}
      {layout.isPending && <p className="search-notice">Loading interior boundaries…</p>}
      {layout.isError && (
        <p className="search-notice">
          Interior boundaries unavailable; the floor outline remains available.
        </p>
      )}
      <details className="route-indoor-details">
        <summary>Map key & coverage</summary>
        <p>
          North up · purple outline · grey boundaries · teal openings. Boundaries do not identify
          public walking space.
        </p>
        <p className="floor-coverage-note">
          Floor plan only. The route is not assigned to these floors yet. Follow the source
          directions for level changes; connected lift levels and current availability are
          unconfirmed.
        </p>
      </details>
      <small>Source: Lands Department · source update time unavailable.</small>
    </section>
  );
}

function FloorDiagram({
  floor,
  points,
  layout,
  selected,
  onSelect,
}: {
  floor: IndoorFloor;
  points: import('@hk/contracts').IndoorPoint[];
  layout?: import('@hk/contracts').IndoorLayout;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const coordinates = floor.polygons.flat(2);
  const lng0 = coordinates[0]![0],
    lat0 = coordinates[0]![1];
  const project = (p: number[]) => [
    (p[0]! - lng0) * Math.cos((lat0 * Math.PI) / 180),
    -(p[1]! - lat0),
  ];
  const xy = [...coordinates.map(project), ...points.map((p) => project([p.lng, p.lat]))];
  const minX = Math.min(...xy.map((p) => p[0]!)),
    minY = Math.min(...xy.map((p) => p[1]!));
  const width = Math.max(...xy.map((p) => p[0]!)) - minX,
    height = Math.max(...xy.map((p) => p[1]!)) - minY;
  const scale = 280 / Math.max(width, height, 0.000001);
  const display = (p: number[]) => {
    const [x, y] = project(p);
    return [
      20 + (x! - minX) * scale + (280 - width * scale) / 2,
      20 + (y! - minY) * scale + (280 - height * scale) / 2,
    ];
  };
  const path = (ring: number[][]) =>
    ring.map((p, i) => `${i ? 'L' : 'M'}${display(p).join(',')}`).join(' ');
  return (
    <div className="floor-diagram">
      <svg
        viewBox="0 0 320 320"
        role="img"
        aria-label={`${floor.name}, official floor boundary and mapped points`}
      >
        {floor.polygons.map((polygon, i) => (
          <path
            key={i}
            d={polygon.map((r) => path(r) + 'Z').join(' ')}
            fill="#f4f0fa"
            fillRule="evenodd"
            stroke="#765aa2"
            strokeWidth="1.5"
          />
        ))}
        {layout?.units
          .filter((u) => u.levelId === floor.id)
          .flatMap((u) =>
            u.lines.map((l, i) => (
              <path key={`${u.id}-${i}`} d={path(l)} fill="none" stroke="#9baba8" strokeWidth="1" />
            )),
          )}
        {layout?.openings
          .filter((u) => u.levelId === floor.id)
          .flatMap((u) =>
            u.lines.map((l, i) => (
              <path key={`${u.id}-${i}`} d={path(l)} fill="none" stroke="#087f8c" strokeWidth="2" />
            )),
          )}
      </svg>
      {points.map((p, i) => {
        const [x, y] = display([p.lng, p.lat]);
        return (
          <button
            key={p.id}
            className="floor-plan-point"
            style={{ left: `${(x! / 320) * 100}%`, top: `${(y! / 320) * 100}%` }}
            aria-label={`${i + 1}. ${p.name}, ${indoorCategoryLabels[p.category]}`}
            aria-pressed={selected === p.id}
            onClick={() => onSelect(p.id)}
          >
            <NavigationIcon kind={p.category} />
          </button>
        );
      })}
    </div>
  );
}
