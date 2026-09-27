import { z } from 'zod';
import { coordinatesSchema } from './search';
export const indoorStationSchema = z.object({ id: z.uuid(), name: z.string(), nameZh: z.string() });
export const indoorPointSchema = coordinatesSchema.extend({
  id: z.uuid(),
  venueId: z.uuid(),
  levelId: z.uuid(),
  name: z.string(),
  nameZh: z.string(),
  levelName: z.string(),
  levelNameZh: z.string(),
  category: z.enum(['entry', 'elevator', 'platform', 'ramp', 'stairs', 'escalator']),
  z: z.number().finite().min(-500).max(2000),
});
export const indoorStationsSchema = z.object({
  stations: z.array(indoorStationSchema),
  fetchedAt: z.iso.datetime(),
});
export const indoorPointsSchema = z.object({
  points: z.array(indoorPointSchema),
  fetchedAt: z.iso.datetime(),
  sourceUpdatedAt: z.null(),
});
export type IndoorStation = z.infer<typeof indoorStationSchema>;
export type IndoorPoint = z.infer<typeof indoorPointSchema>;
export type IndoorPoints = z.infer<typeof indoorPointsSchema>;

const floorPosition = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const floorRing = z.array(floorPosition).min(4).max(20000);
export const indoorFloorSchema = z.object({
  id: z.uuid(),
  venueId: z.uuid(),
  name: z.string(),
  nameZh: z.string(),
  z: z.number().finite().min(-500).max(2000),
  // MultiPolygon shape; inner rings remain holes, not additional walkable areas.
  polygons: z.array(z.array(floorRing).min(1).max(200)).min(1).max(200),
});
export const indoorFloorsSchema = z.object({
  floors: z.array(indoorFloorSchema).max(4999),
  fetchedAt: z.iso.datetime(),
  sourceUpdatedAt: z.null(),
});
export type IndoorFloor = z.infer<typeof indoorFloorSchema>;
export type IndoorFloors = z.infer<typeof indoorFloorsSchema>;

const indoorLayoutFeatureSchema = z.object({
  id: z.uuid(),
  venueId: z.uuid(),
  levelId: z.uuid(),
  category: z.string(),
  name: z.string(),
  z: z.number().finite().min(-500).max(2000),
  // Unit boundaries and opening lines share a rendering shape, not routing semantics.
  lines: z.array(z.array(floorPosition).min(2).max(20000)).min(1).max(2000),
});
export const indoorLayoutSchema = z.object({
  units: z.array(indoorLayoutFeatureSchema).max(4999),
  openings: z.array(indoorLayoutFeatureSchema).max(4999),
  fetchedAt: z.iso.datetime(),
  sourceUpdatedAt: z.null(),
});
export type IndoorLayoutFeature = z.infer<typeof indoorLayoutFeatureSchema>;
export type IndoorLayout = z.infer<typeof indoorLayoutSchema>;
export { indoorLayoutFeatureSchema };
