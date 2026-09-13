import { z } from 'zod';

export const rainfallSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  issuedAt: z.iso.datetime(),
  width: z.literal(121),
  height: z.literal(121),
  // Raster bounds are outer cell edges; values run west to east, north to south.
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  frames: z
    .array(
      z.object({
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        values: z.array(z.number().nonnegative().nullable()).length(14641),
      }),
    )
    .length(4),
});
export type Rainfall = z.infer<typeof rainfallSchema>;
export type RainFrame = Rainfall['frames'][number];
