import { useQuery } from '@tanstack/react-query';
import { facilitiesResponseSchema } from '@hk/contracts';
import { getJson } from '../live/queries';

export function useFacilities(enabled: boolean) {
  return useQuery({
    queryKey: ['facilities'],
    enabled,
    queryFn: async ({ signal }) =>
      facilitiesResponseSchema.parse(await getJson('/api/v1/search/facilities', signal)),
    staleTime: 5 * 60000,
    // Retry a preparing catalogue without blocking the rest of Explore.
    refetchInterval: (query) =>
      query.state.data?.sources.some((source) => source.status === 'unavailable') ? 30000 : false,
  });
}
