import { z } from 'zod';
import { coordinatesSchema, withinHongKong } from './search';

export const routeEndpointSchema = coordinatesSchema
  .extend({
    name: z.string().trim().min(1).max(1000),
    indoor: z.object({ venueId: z.uuid(), pointId: z.uuid() }).optional(),
    // Source heights are optional. Never derive a floor or ground height from GPS.
    z: z.number().finite().min(-500).max(2000).optional(),
  })
  .refine(withinHongKong, 'Choose a location in Hong Kong.');
export const routeRequestSchema = z.object({
  start: routeEndpointSchema,
  end: routeEndpointSchema,
  profile: z.enum(['recommended', 'shortest', 'barrier-free']),
  language: z.enum(['en', 'zh-HK']).default('en'),
});
export type RouteEndpoint = z.infer<typeof routeEndpointSchema>;
export type RouteRequest = z.infer<typeof routeRequestSchema>;
export const walkingRouteSchema = z.object({
  request: routeRequestSchema,
  paths: z
    .array(
      z
        .array(z.tuple([z.number().finite(), z.number().finite(), z.number().finite().nullable()]))
        .min(2),
    )
    .min(1),
  distanceM: z.number().finite().nonnegative(),
  durationMinutes: z.number().finite().nonnegative(),
  steps: z.array(
    z.object({
      text: z.string(),
      distanceM: z.number().nonnegative(),
      durationMinutes: z.number().nonnegative(),
    }),
  ),
  endpointOffsetsM: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  fetchedAt: z.iso.datetime(),
  sourceUpdatedAt: z.null(),
  sourceUrl: z.url(),
  warnings: z.array(z.string()),
});
export type WalkingRoute = z.infer<typeof walkingRouteSchema>;
