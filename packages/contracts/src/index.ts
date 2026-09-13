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

export const weatherSummarySchema = z.object({
  temperature: z.number().nullable(),
  humidity: z.number().nullable(),
  condition: z.string(),
  icon: z.number().nullable(),
  station: z.string(),
  updatedAt: z.iso.datetime().nullable(),
});

export const arrivalSchema = z.object({
  destinationCode: z.string().optional(),
  direction: z.enum(['UP', 'DOWN']).optional(),
  id: z.string(),
  destination: z.string(),
  platform: z.string(),
  time: z.iso.datetime(),
  remark: z.string(),
});

export type WeatherSummary = z.infer<typeof weatherSummarySchema>;
export type Arrival = z.infer<typeof arrivalSchema>;
export type DataMode = 'live' | 'fixture';

export function feedSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema.nullable(),
    provider: z.string(),
    sourceUrl: z.url(),
    fetchedAt: z.iso.datetime(),
    sourceUpdatedAt: z.iso.datetime().nullable(),
    status: z.enum(['fresh', 'stale', 'unavailable']),
    error: z.string().optional(),
    mode: z.enum(['live', 'fixture']).optional(),
  });
}

export interface Feed<T> {
  data: T | null;
  provider: string;
  sourceUrl: string;
  /** Last successful fetch, or attempted fetch when no usable data exists. */
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  status: 'fresh' | 'stale' | 'unavailable';
  error?: string;
  mode?: DataMode;
}

export const weatherFeedSchema = feedSchema(weatherSummarySchema);
export const arrivalsFeedSchema = feedSchema(z.array(arrivalSchema));

export { rainfallSchema } from './rainfall';
export type { Rainfall, RainFrame } from './rainfall';
export { trafficCameraSchema, cameraCatalogueSchema } from './cameras';
export type { TrafficCamera } from './cameras';
export { mtrLines, mtrStations, mtrStationLocations, stationSelectionSchema } from './mtr';
export type { StationSelection } from './mtr';
export { regionalWeatherSchema } from './regional-weather';
export type { RegionalObservation } from './regional-weather';
export {
  busRouteQuerySchema,
  busEtaQuerySchema,
  busRoutesSchema,
  busStopsSchema,
  busStopSchema,
  busArrivalsSchema,
} from './buses';
export type { BusRouteQuery, BusRoute, BusStop, BusArrival } from './buses';
export { nearbyBusQuerySchema, nearbyBusStopsSchema, reportedBusRoutesSchema } from './buses';
export type { NearbyBusStop, ReportedBusRoute } from './buses';
