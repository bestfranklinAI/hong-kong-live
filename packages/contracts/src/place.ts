import { z } from 'zod';
export const categorySchema = z.enum(['landmark', 'park', 'waterfront', 'culture', 'station']);
export const viewModeSchema = z.enum(['explore', 'weather', 'transport']);
export const qualitySchema = z.enum(['efficient', 'balanced', 'detailed']);

export const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nameZh: z.string(),
  district: z.string(),
  category: categorySchema,
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  description: z.string(),
  tags: z.array(z.string()),
  source: z.object({ name: z.string(), url: z.url() }),
  station: z.object({ line: z.string(), code: z.string() }).optional(),
});

export type Place = z.infer<typeof placeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type ViewMode = z.infer<typeof viewModeSchema>;
export type Quality = z.infer<typeof qualitySchema>;
