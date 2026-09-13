import { z } from 'zod';

export const busRouteQuerySchema = z.object({
  route: z.string().regex(/^[A-Z0-9]{1,8}$/),
  bound: z.enum(['O', 'I']),
  service: z.string().regex(/^[1-9][0-9]{0,2}$/),
});
export const busRouteSchema = busRouteQuerySchema.extend({
  origin: z.string(),
  originZh: z.string(),
  destination: z.string(),
  destinationZh: z.string(),
});
export const busStopSchema = z.object({
  id: z.string().regex(/^(?:[A-F0-9]{16}|[0-9]{6})$/),
  seq: z.number().int().positive(),
  name: z.string(),
  nameZh: z.string(),
  lng: z.number().min(113.8).max(114.5),
  lat: z.number().min(22.1).max(22.6),
});
export const busEtaQuerySchema = busRouteQuerySchema.extend({
  seq: z.coerce.number().int().min(1).max(200),
});
export const busArrivalSchema = z.object({
  id: z.string(),
  time: z.iso.datetime().nullable(),
  destination: z.string(),
  remark: z.string(),
  remarkZh: z.string(),
});
export const busRoutesSchema = z.array(busRouteSchema).max(5000);
export const busStopsSchema = z.array(busStopSchema).max(200);
export const busArrivalsSchema = z.array(busArrivalSchema).max(20);
export type BusRouteQuery = z.infer<typeof busRouteQuerySchema>;
export type BusRoute = z.infer<typeof busRouteSchema>;
export type BusStop = z.infer<typeof busStopSchema>;
export type BusArrival = z.infer<typeof busArrivalSchema>;

export const nearbyBusQuerySchema = z.object({
  lng: z.coerce.number().min(113.8).max(114.5),
  lat: z.coerce.number().min(22.1).max(22.6),
});
export const nearbyBusStopsSchema = z
  .array(busStopSchema.omit({ seq: true }).extend({ distance: z.number().min(0).max(800) }))
  .max(20);
export const reportedBusRoutesSchema = z
  .array(busRouteQuerySchema.extend({ seq: z.number().int().min(1).max(200) }))
  .max(300);
export type NearbyBusStop = z.infer<typeof nearbyBusStopsSchema>[number];
export type ReportedBusRoute = z.infer<typeof reportedBusRoutesSchema>[number];
