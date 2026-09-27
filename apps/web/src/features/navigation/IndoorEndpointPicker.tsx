import { NavigationIcon } from './NavigationIcon';
import { indoorCategoryLabels, type IndoorMapChoice } from './indoor-map';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  indoorStationsSchema,
  indoorPointsSchema,
  indoorFloorsSchema,
  indoorLayoutSchema,
  type RouteEndpoint,
} from '@hk/contracts';
import { getJson } from '../live/queries';
export function IndoorEndpointPicker({
  onSelect,
  onMap,
}: {
  onSelect: (point: RouteEndpoint) => void;
  onMap: (choice: IndoorMapChoice | null) => void;
}) {
  const [stationId, setStationId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [showLayout, setShowLayout] = useState(false);
  const [category, setCategory] = useState('entry');
  useEffect(() => () => onMap(null), [stationId, levelId, category, showLayout, onMap]);
  const stations = useQuery({
    queryKey: ['indoor-stations'],
    queryFn: async ({ signal }) =>
      indoorStationsSchema.parse(await getJson('/api/v1/routes/indoor/stations', signal)),
    staleTime: 6 * 3600000,
    retry: 1,
  });
  const points = useQuery({
    queryKey: ['indoor-points', stationId],
    enabled: !!stationId,
    queryFn: async ({ signal }) =>
      indoorPointsSchema.parse(
        await getJson(`/api/v1/routes/indoor/stations/${stationId}/points`, signal),
      ),
    staleTime: 6 * 3600000,
    retry: 1,
  });
  const floors = useQuery({
    queryKey: ['indoor-floors', stationId],
    enabled: !!stationId,
    queryFn: async ({ signal }) =>
      indoorFloorsSchema.parse(
        await getJson(`/api/v1/routes/indoor/stations/${stationId}/floors`, signal),
      ),
    staleTime: 6 * 3600000,
    retry: 1,
  });
  const layout = useQuery({
    queryKey: ['indoor-layout', stationId],
    enabled: !!stationId && showLayout,
    queryFn: async ({ signal }) =>
      indoorLayoutSchema.parse(
        await getJson(`/api/v1/routes/indoor/stations/${stationId}/layout`, signal),
      ),
    staleTime: 6 * 3600000,
    retry: 1,
  });
  const station = stations.data?.stations.find((s) => s.id === stationId);
  const levels = [
    ...new Map(
      (points.data?.points ?? []).map((p) => [
        p.levelId,
        { id: p.levelId, name: p.levelName, nameZh: p.levelNameZh, z: p.z },
      ]),
    ).values(),
  ].sort((a, b) => b.z - a.z || a.name.localeCompare(b.name));
  const rows =
    points.data?.points.filter(
      (p) => p.levelId === levelId && (category === 'all' || p.category === category),
    ) ?? [];
  function choose(p: (typeof rows)[number]) {
    onSelect({
      name: `${station?.name ?? 'Station'} · ${p.levelName} · ${p.name}`,
      lng: p.lng,
      lat: p.lat,
      z: p.z,
      indoor: { venueId: p.venueId, pointId: p.id },
    });
  }
  return (
    <section className="indoor-picker" aria-label="Station level and point picker">
      <p className="search-notice">
        Choose an official mapped point on a named level. Exit signs can be inside a concourse;
        these points do not certify step-free access or current opening.
      </p>
      <label>
        Station
        <select
          value={stationId}
          onChange={(e) => {
            setStationId(e.target.value);
            setLevelId('');
          }}
        >
          <option value="">Choose a station</option>
          {stations.data?.stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.nameZh}
            </option>
          ))}
        </select>
      </label>
      {stations.isPending && <p role="status">Loading official station catalogue…</p>}
      {stations.isError && (
        <p role="alert">
          Station catalogue unavailable.{' '}
          <button onClick={() => void stations.refetch()}>Retry</button>
        </p>
      )}
      {stationId && (
        <>
          {points.isPending && <p role="status">Loading mapped station points…</p>}
          {points.isError && (
            <p role="alert">
              Station points unavailable.{' '}
              <button onClick={() => void points.refetch()}>Retry</button>
            </p>
          )}
          <label>
            Station level
            <select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
              <option value="">Choose a level with mapped points</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.nameZh}
                </option>
              ))}
            </select>
          </label>
          <label>
            Point type
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="entry">Exits / entries</option>
              <option value="elevator">Lifts</option>
              <option value="platform">Platforms</option>
              <option value="ramp">Ramps</option>
              <option value="stairs">Stairs</option>
              <option value="escalator">Escalators</option>
              <option value="all">All mapped routing points</option>
            </select>
          </label>
          {levelId && !rows.length && !points.isPending && (
            <p>No matching points on this level. Try another point type.</p>
          )}
          <label className="indoor-detail-toggle">
            <input
              type="checkbox"
              checked={showLayout}
              onChange={(e) => setShowLayout(e.target.checked)}
            />
            Show unit boundaries and openings
          </label>
          {showLayout && layout.isError && (
            <p role="status">
              Detailed layout unavailable. Points and floor outlines remain available.{' '}
              <button onClick={() => void layout.refetch()}>Retry layout</button>
            </p>
          )}
          {rows.length > 0 && (
            <button
              className="walking-submit"
              disabled={floors.isPending || (showLayout && layout.isPending)}
              onClick={() =>
                onMap({
                  points: rows,
                  layout:
                    showLayout && layout.data
                      ? {
                          ...layout.data,
                          units: layout.data.units.filter((r) => r.levelId === levelId),
                          openings: layout.data.openings.filter((r) => r.levelId === levelId),
                        }
                      : undefined,
                  floor: floors.data?.floors.find((f) => f.id === levelId),
                  stationName: station?.name ?? 'Station',
                  levelName: rows[0].levelName,
                  select: choose,
                })
              }
            >
              {floors.isPending || (showLayout && layout.isPending)
                ? 'Loading station geometry…'
                : `Choose on map (${rows.length})`}
            </button>
          )}
          {floors.isError && (
            <p role="status">
              Floor outline unavailable. You can still select points.{' '}
              <button onClick={() => void floors.refetch()}>Retry outline</button>
            </p>
          )}
          {rows.map((p, index) => (
            <button
              key={p.id}
              className="search-result indoor-point-result"
              onClick={() => choose(p)}
            >
              <span className="indoor-point-symbol">
                <NavigationIcon kind={p.category} />
              </span>
              <span>
                <strong>
                  {index + 1}. {p.name} · {p.nameZh}
                </strong>
                <span>
                  {indoorCategoryLabels[p.category]} · {p.levelName}
                </span>
                <small>
                  {p.lat.toFixed(6)}, {p.lng.toFixed(6)} · source point
                </small>
              </span>
            </button>
          ))}
          {points.data && (
            <p className="search-provenance">
              Lands Department · fetched {points.data.fetchedAt.slice(0, 10)}. Publication time not
              supplied. Levels listed here have mapped routing points.
            </p>
          )}
        </>
      )}
    </section>
  );
}
