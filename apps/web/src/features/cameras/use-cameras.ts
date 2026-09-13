import { useQuery } from '@tanstack/react-query';
import { cameraCatalogueSchema, feedSchema } from '@hk/contracts';

export function useCameras(enabled: boolean) {
  return useQuery({
    queryKey: ['cameras'],
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/v1/cameras', { signal });
      if (!response.ok) throw new Error('Camera locations are unavailable.');
      return feedSchema(cameraCatalogueSchema).parse(await response.json());
    },
    staleTime: 60 * 60_000,
    refetchInterval: enabled ? 60 * 60_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
