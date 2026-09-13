import { z } from 'zod';

export const trafficCameraSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,24}$/),
  name: z.string().min(1).max(300),
  district: z.string().min(1).max(80),
  region: z.string().min(1).max(80),
  lat: z.number().min(22).max(23),
  lng: z.number().min(113).max(115),
  imageUrl: z.string().regex(/^https:\/\/tdcctv\.data\.one\.gov\.hk\/[A-Za-z0-9_-]{1,24}\.JPG$/),
});
export const cameraCatalogueSchema = z.array(trafficCameraSchema).min(1).max(2000);
export type TrafficCamera = z.infer<typeof trafficCameraSchema>;
