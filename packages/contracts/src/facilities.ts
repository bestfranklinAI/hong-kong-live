import { z } from 'zod';
import { searchResultSchema } from './search';

export const facilityCategorySchema = z.enum(['sports', 'library', 'refill']);
export type FacilityCategory = z.infer<typeof facilityCategorySchema>;
export const facilityLabels: Record<FacilityCategory, string> = {
  sports: 'Sports centres',
  library: 'Libraries',
  refill: 'Water refill',
};
export const facilitySnapshotSchema = z.object({
  dataset: z.string(),
  fetchedAt: z.iso.datetime(),
  records: z.array(searchResultSchema).max(10000),
});
export type FacilitySnapshot = z.infer<typeof facilitySnapshotSchema>;
export const facilitiesResponseSchema = z.object({
  records: z.array(searchResultSchema),
  sources: z.array(
    z.object({
      dataset: z.string(),
      title: z.string(),
      category: facilityCategorySchema,
      fetchedAt: z.string().nullable(),
      count: z.number(),
      status: z.enum(['ready', 'stale', 'unavailable']),
    }),
  ),
});
export type FacilitiesResponse = z.infer<typeof facilitiesResponseSchema>;
