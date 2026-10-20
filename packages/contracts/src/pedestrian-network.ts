import { z } from 'zod';
import { withinHongKong } from './search';

const point = z
  .tuple([z.number().finite(), z.number().finite()])
  .refine(
    ([lng, lat]) => withinHongKong({ lng, lat }),
    'Network context is only available in Hong Kong.',
  );
export const networkRequestSchema = z
  .object({
    paths: z.array(z.array(point).min(2).max(6000)).min(1).max(20),
    category: z.enum(['connections', 'cover']),
  })
  .strict()
  .superRefine(({ paths }, ctx) => {
    const points = paths.flat();
    let length = 0;
    for (const path of paths)
      for (let i = 1; i < path.length; i++) {
        length += Math.hypot(
          (path[i][0] - path[i - 1][0]) * 103000,
          (path[i][1] - path[i - 1][1]) * 111200,
        );
      }
    if (
      points.length > 6000 ||
      length > 30000 ||
      Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0])) > 0.16 ||
      Math.max(...points.map((p) => p[1])) - Math.min(...points.map((p) => p[1])) > 0.15
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a walking route within the supported extent.',
      });
  });
export const networkSegmentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string().optional(),
  nameZh: z.string().optional(),
  cover: z.enum(['covered', 'uncovered', 'unknown']),
  enabled: z.boolean().nullable(),
  paths: z
    .array(
      z
        .array(z.tuple([z.number().finite(), z.number().finite(), z.number().finite().nullable()]))
        .min(2),
    )
    .min(1),
  floorId: z.string().nullable(),
  accessTimeId: z.string().nullable(),
  amendedAt: z.iso.datetime().nullable(),
});
export const pedestrianNetworkSchema = z.object({
  segments: z.array(networkSegmentSchema).max(1200),
  partial: z.boolean(),
  category: z.enum(['connections', 'cover']),
  corridorM: z.literal(50),
  fetchedAt: z.iso.datetime(),
  sourceUrl: z.url(),
  heightDatum: z.literal('HKPD'),
});
export type NetworkRequest = z.infer<typeof networkRequestSchema>;
export type NetworkSegment = z.infer<typeof networkSegmentSchema>;
export type PedestrianNetwork = z.infer<typeof pedestrianNetworkSchema>;
