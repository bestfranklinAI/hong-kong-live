import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  feedSchema,
  busRoutesSchema,
  busStopsSchema,
  busArrivalsSchema,
  type BusRouteQuery,
} from '@hk/contracts';
import { getJson, useDisplayTime } from '../live/queries';
import { displayFeed } from '../live/display-feed';

export function useBuses(enabled: boolean) {
  const [operator, setOperator] = useState<'kmb' | 'citybus'>('kmb');
  const base = `/api/v1/buses/${operator}`;
  const [selection, setSelection] = useState<BusRouteQuery & { seq: number }>({
    route: '1A',
    bound: 'O',
    service: '1',
    seq: 1,
  });
  const now = useDisplayTime();
  const routes = useQuery({
    queryKey: ['bus-routes', operator],
    enabled,
    staleTime: 3600_000,
    queryFn: async ({ signal }) =>
      feedSchema(busRoutesSchema).parse(await getJson(`${base}/routes`, signal)),
  });
  const routeParams = new URLSearchParams({
    route: selection.route,
    bound: selection.bound,
    service: selection.service,
  }).toString();
  const routeValid = routes.data?.data?.some(
    (r) =>
      r.route === selection.route && r.bound === selection.bound && r.service === selection.service,
  );
  const stops = useQuery({
    queryKey: ['bus-stops', operator, routeParams],
    enabled: enabled && Boolean(routeValid),
    staleTime: 3600_000,
    queryFn: async ({ signal }) =>
      feedSchema(busStopsSchema).parse(await getJson(`${base}/stops?${routeParams}`, signal)),
  });
  const stopFeed = displayFeed(stops.data, stops.isError, now, 86400_000, 3600_000);
  const selected = stopFeed?.data?.find((s) => s.seq === selection.seq) ?? null;
  const arrivals = useQuery({
    queryKey: ['bus-arrivals', operator, routeParams, selection.seq, selected?.id],
    enabled: enabled && Boolean(selected),
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) =>
      feedSchema(busArrivalsSchema).parse(
        await getJson(`${base}/arrivals?${routeParams}&seq=${selection.seq}`, signal),
      ),
  });
  const feed = displayFeed(arrivals.data, arrivals.isError, now, 120_000, 60_000);
  const sourceExpired = feed?.sourceUpdatedAt && now - Date.parse(feed.sourceUpdatedAt) >= 180_000;
  return {
    operator,
    setOperator: (value: 'kmb' | 'citybus') => {
      setOperator(value);
      setSelection({ route: value === 'kmb' ? '1A' : '1', bound: 'O', service: '1', seq: 1 });
    },
    selection,
    setSelection,
    routes,
    stops,
    stopFeed,
    selected,
    arrivals,
    feed: sourceExpired && feed ? { ...feed, data: null, status: 'unavailable' as const } : feed,
  };
}
export type BusExplorer = ReturnType<typeof useBuses>;
