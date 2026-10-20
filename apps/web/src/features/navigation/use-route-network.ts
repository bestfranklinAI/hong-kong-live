import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pedestrianNetworkSchema, type NetworkRequest, type WalkingRoute } from '@hk/contracts';
import { networkKinds, type NetworkKind } from './network-labels';

export function useRouteNetwork(route: WalkingRoute | null) {
  const client = useQueryClient();
  const [selection, setSelection] = useState<{
    route: WalkingRoute | null;
    visible: boolean;
    category: NetworkRequest['category'];
    kind: NetworkKind;
  }>({ route: null, visible: false, category: 'connections', kind: 'all' });
  const visible = !!route && selection.route === route && selection.visible;
  const category = selection.route === route ? selection.category : 'connections';
  const kind = selection.route === route ? selection.kind : 'all';
  const paths = useMemo(
    () => route?.paths.map((path) => path.map(([lng, lat]) => [lng, lat] as [number, number])),
    [route],
  );
  const queryKey = useMemo(() => ['route-network', paths, category], [paths, category]);
  useEffect(() => {
    if (!visible) {
      void client.cancelQueries({ queryKey, exact: true });
      return;
    }
    return () => {
      void client.cancelQueries({ queryKey, exact: true });
    };
  }, [client, queryKey, visible]);
  const query = useQuery({
    queryKey,
    enabled: visible,
    staleTime: 6 * 3600000,
    gcTime: 60000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/v1/routes/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, category }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Nearby paths are unavailable.',
        );
      return pedestrianNetworkSchema.parse(data);
    },
  });
  const data = useMemo(
    () =>
      visible && query.data
        ? {
            ...query.data,
            segments:
              category === 'connections' && kind !== 'all'
                ? query.data.segments.filter((segment) => segment.kind === kind)
                : query.data.segments,
          }
        : undefined,
    [visible, query.data, category, kind],
  );
  const availableKinds = networkKinds.filter((row) =>
    query.data?.segments.some((segment) => segment.kind === row.value),
  );
  return {
    visible,
    category,
    kind,
    availableKinds,
    data,
    loading: visible && query.isFetching,
    error: visible ? query.error : null,
    retry: () => void query.refetch(),
    setVisible: (visible: boolean) => setSelection({ route, visible, category, kind }),
    setKind: (kind: NetworkKind) => setSelection({ route, visible: true, category, kind }),
    setCategory: (category: NetworkRequest['category']) =>
      setSelection({ route, visible: true, category, kind: 'all' }),
  };
}
export type RouteNetworkState = ReturnType<typeof useRouteNetwork>;
