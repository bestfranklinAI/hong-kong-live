import { normalizeIndoorLayout } from './indoor-layout';
import { z } from 'zod';
import {
  indoorPointSchema,
  indoorFloorSchema,
  type IndoorFloors,
  type IndoorLayout,
  indoorStationSchema,
  withinHongKong,
  type IndoorPoints,
  type IndoorStation,
  type RouteEndpoint,
} from '@hk/contracts';
import { fetchJson, ProviderError, type Fetcher } from './http';
const BASE = 'https://mapapi.hkmapservice.gov.hk/ogc/wfs/indoor/';
const collection = z.object({
  features: z
    .array(
      z.object({ properties: z.record(z.string(), z.unknown()), geometry: z.unknown().optional() }),
    )
    .max(4999),
});
const text = (v: unknown) => (typeof v === 'string' ? v : '');
export function normalizeIndoorStations(raw: unknown): IndoorStation[] {
  return collection
    .parse(raw)
    .features.map(({ properties: p }) =>
      indoorStationSchema.parse({
        id: p.venue_id,
        name: p.venue_name_en,
        nameZh: text(p.venue_name_zh),
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function normalizeIndoorPoints(raw: unknown, venueId: string) {
  const points: IndoorPoints['points'] = [];
  for (const f of collection.parse(raw).features) {
    const p = f.properties;
    if (
      !['entry', 'elevator', 'platform', 'ramp', 'stairs', 'escalator'].includes(
        text(p.amenity_category),
      )
    )
      continue;
    if (p.venue_id !== venueId) throw new ProviderError('Indoor source returned another station.');
    const geometry = z
      .object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
      })
      .parse(f.geometry);
    const [lng, lat, height] = geometry.coordinates;
    // Keep source geometry Z; reject conflicting level metadata instead of guessing a level.
    if (
      !withinHongKong({ lng, lat }) ||
      typeof p.level_z_value !== 'number' ||
      Math.abs(p.level_z_value - height) > 0.25
    )
      throw new ProviderError(
        'Indoor point height could not be verified against its source level.',
      );
    points.push(
      indoorPointSchema.parse({
        id: p.amenity_id,
        venueId,
        levelId: p.level_id,
        name: text(p.amenity_name_en) || text(p.amenity_category),
        nameZh: text(p.amenity_name_zh),
        levelName: p.level_name_en,
        levelNameZh: text(p.level_name_zh),
        category: p.amenity_category,
        lng,
        lat,
        z: height,
      }),
    );
  }
  if (new Set(points.map((p) => p.id)).size !== points.length)
    throw new ProviderError('Indoor source contains duplicate points.');
  return points;
}
/** Keep source rings and level identities; never derive floors from geometry bounds. */
export function normalizeIndoorFloors(raw: unknown, venueId: string): IndoorFloors['floors'] {
  let vertices = 0;
  const floors = collection.parse(raw).features.map(({ properties: p, geometry }) => {
    if (p.venue_id !== venueId) throw new ProviderError('Indoor source returned another station.');
    const g = z
      .object({ type: z.enum(['Polygon', 'MultiPolygon']), coordinates: z.unknown() })
      .parse(geometry);
    const floor = indoorFloorSchema.parse({
      id: p.level_id,
      venueId,
      name: p.level_name_en,
      nameZh: text(p.level_name_zh),
      z: p.level_z_value,
      polygons: g.type === 'Polygon' ? [g.coordinates] : g.coordinates,
    });
    for (const polygon of floor.polygons)
      for (const ring of polygon) {
        vertices += ring.length;
        if (vertices > 100000) throw new ProviderError('Indoor floor geometry is too large.');
        if (ring[0].some((v, i) => v !== ring.at(-1)![i]))
          throw new ProviderError('Indoor floor ring is not closed.');
        if (
          ring.some(
            ([lng, lat, height]) =>
              !withinHongKong({ lng, lat }) || Math.abs(height - floor.z) > 0.25,
          )
        )
          throw new ProviderError('Indoor floor geometry does not match its source level.');
      }
    return floor;
  });
  if (new Set(floors.map((f) => f.id)).size !== floors.length)
    throw new ProviderError('Indoor source contains duplicate levels.');
  return floors;
}
/** Fetch station-by-station; never download every floor or invent point locations from polygons. */
export class IndoorCatalogue {
  private cache = new Map<string, { expires: number; data: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  constructor(
    private fetcher: Fetcher = fetch,
    private now = Date.now,
  ) {}
  private async load<T>(
    key: string,
    feature: string,
    normalize: (raw: unknown) => T,
    venueId?: string,
  ): Promise<{ value: T; fetchedAt: string }> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now())
      return cached.data as { value: T; fetchedAt: string };
    const current = this.pending.get(key);
    if (current) return current as Promise<{ value: T; fetchedAt: string }>;
    if (this.pending.size >= 4)
      throw new ProviderError('Indoor lookup is busy. Try again shortly.');
    const task = (async () => {
      const query = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        outputFormat: 'application/json',
      });
      if (venueId) query.set('cql_filter', `venue_id='${z.uuid().parse(venueId)}'`);
      const raw = await fetchJson(`${BASE}${feature}?${query}`, this.fetcher, {
        maxBytes: 6 * 1024 * 1024,
        timeoutMs: 20000,
      });
      const data = { value: normalize(raw), fetchedAt: new Date(this.now()).toISOString() };
      if (this.cache.size >= 32) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: this.now() + 6 * 3600000, data });
      return data;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }
  async stations() {
    const d = await this.load('stations', 'mtr_venue_polygon', normalizeIndoorStations);
    return { stations: d.value, fetchedAt: d.fetchedAt };
  }
  async points(id: string): Promise<IndoorPoints> {
    z.uuid().parse(id);
    const d = await this.load(
      `points:${id}`,
      'mtr_amenity_point',
      (raw) => normalizeIndoorPoints(raw, id),
      id,
    );
    return { points: d.value, fetchedAt: d.fetchedAt, sourceUpdatedAt: null };
  }
  async floors(id: string): Promise<IndoorFloors> {
    z.uuid().parse(id);
    const d = await this.load(
      `floors:${id}`,
      'mtr_level_polygon',
      (raw) => normalizeIndoorFloors(raw, id),
      id,
    );
    return { floors: d.value, fetchedAt: d.fetchedAt, sourceUpdatedAt: null };
  }
  async layout(id: string): Promise<IndoorLayout> {
    z.uuid().parse(id);
    const [units, openings] = await Promise.all([
      this.load(
        `units:${id}`,
        'mtr_unit_polygon',
        (raw) => normalizeIndoorLayout(raw, id, 'unit'),
        id,
      ),
      this.load(
        `openings:${id}`,
        'mtr_opening_line',
        (raw) => normalizeIndoorLayout(raw, id, 'opening'),
        id,
      ),
    ]);
    // Report the older fetch time rather than implying both layers were refreshed together.
    return {
      units: units.value,
      openings: openings.value,
      fetchedAt: [units.fetchedAt, openings.fetchedAt].sort()[0],
      sourceUpdatedAt: null,
    };
  }
  async resolve(endpoint: RouteEndpoint): Promise<RouteEndpoint> {
    if (!endpoint.indoor) return endpoint;
    const { venueId, pointId } = endpoint.indoor;
    const station = (await this.stations()).stations.find((s) => s.id === venueId);
    if (!station) throw new ProviderError('The selected indoor station is unavailable.');
    const point = (await this.points(venueId)).points.find((p) => p.id === pointId);
    if (!point)
      throw new ProviderError('The selected indoor point is unavailable. Choose it again.');
    return {
      name: `${station.name} · ${point.levelName} · ${point.name}`,
      lat: point.lat,
      lng: point.lng,
      z: point.z,
      indoor: endpoint.indoor,
    };
  }
}
