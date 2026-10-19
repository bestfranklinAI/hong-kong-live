import { z } from 'zod';
import { coordinatesSchema, searchResultSchema, withinHongKong } from './search';

export const discoveryInterestSchema = z.enum([
  'waterfront',
  'park',
  'culture',
  'food',
  'library',
  'refill',
  'sports',
]);
export const discoveryIntentSchema = z
  .object({
    interests: z
      .array(discoveryInterestSchema)
      .max(4)
      .refine((values) => new Set(values).size === values.length),
    area: z.string().trim().max(80),
    mobility: z.enum(['walking', 'fewer-stairs', 'barrier-free']),
    unverifiedNeeds: z
      .array(z.enum(['open-now', 'working-lifts', 'indoor-position', 'covered-walk']))
      .max(4)
      .refine((values) => new Set(values).size === values.length),
  })
  .strict();
export const discoveryRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    language: z.enum(['en', 'tc']),
    center: coordinatesSchema.refine(withinHongKong).optional(),
  })
  .strict();
/** A model can order retrieved IDs; it cannot supply a place, coordinate or route. */
export const discoveryRankingSchema = z
  .object({
    candidateIds: z
      .array(z.string().min(1).max(240))
      .max(8)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export const discoveryResponseSchema = z
  .object({
    experimental: z.literal(true),
    mode: z.enum(['live', 'fixture']),
    intent: discoveryIntentSchema,
    ranking: z.enum(['model', 'retrieval-fallback', 'not-run']),
    /** Requested interests absent from the retrieved pool, before model ranking. */
    unmatchedInterests: z
      .array(discoveryInterestSchema)
      .max(4)
      .refine((values) => new Set(values).size === values.length),
    results: z.array(searchResultSchema).max(8),
    notices: z.array(z.string()),
  })
  .strict();
export type DiscoveryIntent = z.infer<typeof discoveryIntentSchema>;
export type DiscoveryRequest = z.infer<typeof discoveryRequestSchema>;
export type DiscoveryResponse = z.infer<typeof discoveryResponseSchema>;
export type DiscoveryInterest = z.infer<typeof discoveryInterestSchema>;
export const discoveryStatusSchema = z
  .object({ experimental: z.literal(true), enabled: z.boolean() })
  .strict();

export const discoveryReplaySchema = z
  .object({
    provider: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    cases: z
      .array(
        z
          .object({ id: z.string(), interpretation: z.unknown(), ranking: z.unknown().optional() })
          .strict(),
      )
      .max(32)
      .refine((cases) => new Set(cases.map((row) => row.id)).size === cases.length),
  })
  .strict();
export type DiscoveryReplay = z.infer<typeof discoveryReplaySchema>;
