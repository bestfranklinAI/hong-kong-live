import { routeExit } from './route-exit';
import { useCallback, useMemo } from 'react';
import { useQuery, useQueries, type UseQueryResult } from '@tanstack/react-query';
import {
  indoorStationsSchema,
  indoorVenuesSchema,
  indoorPointsSchema,
  type IndoorPoints,
  indoorFloorsSchema,
  type WalkingRoute,
  type IndoorFloors,
  type StationRouteContext,
  type StationRouteView,
} from '@hk/contracts';
import { getJson } from '../live/queries';
import { stationFloorRequest } from './station-floor-requests';
import { directionNamesStation, endpointStation, stationNameKey } from './station-endpoint';
import { classifyVenueRoute } from './venue-route-match';
export function useRouteStations(route: WalkingRoute | null) {
  const catalogue = useQuery({
    queryKey: ['indoor-stations'],
    enabled: !!route,
    queryFn: async ({ signal }) =>
      indoorStationsSchema.parse(await getJson('/api/v1/routes/indoor/stations', signal)),
    staleTime: 21600000,
    retry: 1,
  });
  const buildings = useQuery({
    queryKey: ['indoor-buildings'],
    enabled: !!route,
    queryFn: async ({ signal }) =>
      indoorVenuesSchema.parse(await getJson('/api/v1/routes/indoor/buildings', signal)),
    staleTime: 21600000,
    retry: 1,
  });
  const venues = useMemo(() => {
    if (!route) return [];
    return [
      ...(catalogue.data?.stations ?? []).map((venue) => ({ ...venue, kind: 'station' as const })),
      ...(buildings.data?.venues ?? []),
    ]
      .map((venue) => ({
        venue,
        endpointRoles: (['start', 'end'] as const).filter((role) => {
          const point = route.request[role];
          return point.indoor
            ? point.indoor.venueId === venue.id
            : stationNameKey(endpointStation(point)?.name ?? '') === stationNameKey(venue.name);
        }),
      }))
      .filter(
        (row) =>
          row.endpointRoles.length ||
          route.steps.some((step) => directionNamesStation(step.text, row.venue)),
      )
      .sort(
        (a, b) =>
          Number(b.endpointRoles.includes('start')) - Number(a.endpointRoles.includes('start')),
      );
  }, [route, catalogue.data, buildings.data]);
  const combine = useCallback(
    (queries: UseQueryResult<IndoorFloors>[]) => ({
      contexts: route
        ? venues
            .flatMap((row, index): StationRouteContext[] => {
              const data = queries[index].data;
              if (!data) return [];
              const segments = classifyVenueRoute(route, data.floors, row.venue);
              return segments.length ? [{ ...row, floors: data.floors, segments }] : [];
            })
            .sort(
              (a, b) =>
                a.segments[0].pathIndex - b.segments[0].pathIndex ||
                a.segments[0].segmentIndex - b.segments[0].segmentIndex,
            )
        : [],
      loading: queries.some((query) => query.isFetching),
      unavailable: queries.some((query) => query.isError),
    }),
    [route, venues],
  );
  const result = useQueries({
    queries: venues.map(({ venue }) => ({
      queryKey: ['indoor-floors', venue.id, venue.kind ?? 'station'],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        stationFloorRequest(signal, async () =>
          indoorFloorsSchema.parse(
            await getJson(
              `/api/v1/routes/indoor/${venue.kind === 'building' ? 'buildings' : 'stations'}/${venue.id}/floors`,
              signal,
            ),
          ),
        ),
      staleTime: 21600000,
      retry: 1,
    })),
    combine,
  });
  const contexts = result.contexts;
  const exitData = useQueries({
    queries: contexts.map((context) => ({
      queryKey: ['indoor-points', context.venue.id, context.venue.kind ?? 'station'],
      enabled: context.endpointRoles.includes('start'),
      staleTime: 21600000,
      retry: 1,
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        stationFloorRequest(signal, async () =>
          indoorPointsSchema.parse(
            await getJson(
              `/api/v1/routes/indoor/${context.venue.kind === 'building' ? 'buildings' : 'stations'}/${context.venue.id}/points`,
              signal,
            ),
          ),
        ),
    })),
    combine: useCallback(
      (queries: UseQueryResult<IndoorPoints>[]) => queries.map((query) => query.data),
      [],
    ),
  });
  const view = useMemo<StationRouteView>(
    () => ({
      segments: contexts.flatMap((context) => context.segments),
      stations: contexts.map((context, index) => {
        const exit = routeExit(route!, context, exitData[index]?.points ?? []);
        const segment = context.segments[Math.floor(context.segments.length / 2)];
        const p = route!.paths[segment.pathIndex][segment.segmentIndex];
        return {
          kind: context.venue.kind,
          exitName: exit?.name,
          id: context.venue.id,
          name: context.venue.name,
          nameZh: context.venue.nameZh,
          lng: exit?.lng ?? p[0],
          lat: exit?.lat ?? p[1],
        };
      }),
    }),
    [route, contexts, exitData],
  );
  return {
    contexts,
    view,
    loading: !!route && (catalogue.isFetching || buildings.isFetching || result.loading),
    unavailable: catalogue.isError || buildings.isError || result.unavailable,
  };
}
