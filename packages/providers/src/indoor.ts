import { normalizeIndoorLayout } from './indoor-layout';
import { z } from 'zod';
import {
  indoorPointSchema,
  indoorFloorSchema,
  type IndoorFloors,
  type IndoorVenue,
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
    const category = text(p.amenity_category).startsWith('restroom')
      ? 'restroom'
      : text(p.amenity_category);
    if (
      !['entry', 'elevator', 'platform', 'ramp', 'stairs', 'escalator', 'restroom'].includes(
        category,
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
        category,
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
      if (feature === 'venue_polygon')
        query.set('propertyName', 'venue_id,venue_name_en,venue_name_zh');
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
  async buildings(): Promise<{ venues: IndoorVenue[]; fetchedAt: string }> {
    const d = await this.load('buildings', 'venue_polygon', (raw) => {
      const records = new Map(
        collection.parse(raw).features.map((row) => [row.properties.venue_id, row.properties]),
      );
      return normalizeIndoorStations(raw).map((venue) => {
        // This service's bbox property uses south/west/north/east order.
        const box = z
          .tuple([
            z.number().finite(),
            z.number().finite(),
            z.number().finite(),
            z.number().finite(),
          ])
          .safeParse(records.get(venue.id)?.bbox);
        const location =
          box.success &&
          box.data[0] <= box.data[2] &&
          box.data[1] <= box.data[3] &&
          withinHongKong({ lat: box.data[0], lng: box.data[1] }) &&
          withinHongKong({ lat: box.data[2], lng: box.data[3] })
            ? { lat: (box.data[0] + box.data[2]) / 2, lng: (box.data[1] + box.data[3]) / 2 }
            : undefined;
        return {
          ...venue,
          kind: 'building' as const,
          ...(location && withinHongKong(location) ? { location } : {}),
        };
      });
    });
    return { venues: d.value, fetchedAt: d.fetchedAt };
  }
  async points(id: string, kind: 'station' | 'building' = 'station'): Promise<IndoorPoints> {
    z.uuid().parse(id);
    const d = await this.load(
      `${kind}:points:${id}`,
      kind === 'station' ? 'mtr_amenity_point' : 'amenity_point',
      (raw) => normalizeIndoorPoints(raw, id),
      id,
    );
    return { points: d.value, fetchedAt: d.fetchedAt, sourceUpdatedAt: null };
  }
  async floors(id: string, kind: 'station' | 'building' = 'station'): Promise<IndoorFloors> {
    z.uuid().parse(id);
    const d = await this.load(
      `${kind}:floors:${id}`,
      kind === 'station' ? 'mtr_level_polygon' : 'level_polygon',
      (raw) => normalizeIndoorFloors(raw, id),
      id,
    );
    return { floors: d.value, fetchedAt: d.fetchedAt, sourceUpdatedAt: null };
  }
  async layout(id: string, kind: 'station' | 'building' = 'station'): Promise<IndoorLayout> {
    z.uuid().parse(id);
    const [units, openings] = await Promise.all([
      this.load(
        `${kind}:units:${id}`,
        kind === 'station' ? 'mtr_unit_polygon' : 'unit_polygon',
        (raw) => normalizeIndoorLayout(raw, id, 'unit'),
        id,
      ),
      this.load(
        `${kind}:openings:${id}`,
        kind === 'station' ? 'mtr_opening_line' : 'opening_line',
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
  async resolve(
    endpoint: RouteEndpoint,
    profile?: 'recommended' | 'shortest' | 'barrier-free',
  ): Promise<RouteEndpoint> {
    if (!endpoint.indoor && endpoint.assumedConcourse) {
      const key = (name: string) =>
        name.toLowerCase().replace(/\bmtr\b|\bstation\b|港鐵|鐵路站|站|\s+/g, '');
      const station = (await this.stations()).stations.find(
        (s) => key(s.name) === key(endpoint.name) || key(s.nameZh) === key(endpoint.name),
      );
      if (!station)
        throw new ProviderError(
          'No station concourse is available. Choose a mapped starting point.',
        );
      const floors = (await this.floors(station.id)).floors.filter(
        (f) => /\bconcourse\b/i.test(f.name) || /大堂/.test(f.nameZh),
      );
      const points = (await this.points(station.id)).points;
      const candidates = points.filter(
        (p) =>
          floors.some((f) => f.id === p.levelId) &&
          p.category !== 'platform' &&
          p.category !== 'restroom',
      );
      // Prefer a real internal connector over an exit; never invent a centroid as a walking node.
      const allowed =
        profile === 'barrier-free'
          ? candidates.filter((p) => !['stairs', 'escalator'].includes(p.category))
          : candidates;
      const connectors = allowed.filter((p) => p.category !== 'entry' && p.category !== 'stairs');
      const pool = connectors.length ? connectors : allowed;
      const distance = (p: { lat: number; lng: number }) =>
        Math.hypot(
          p.lat - endpoint.lat,
          (p.lng - endpoint.lng) * Math.cos((endpoint.lat * Math.PI) / 180),
        );
      const point = [...pool].sort((a, b) => distance(a) - distance(b))[0];
      if (!point)
        throw new ProviderError(
          'No mapped concourse starting point is available. Choose an entrance or use current location.',
        );
      return {
        ...endpoint,
        name: `${station.name} · ${point.levelName} (assumed concourse)`,
        lat: point.lat,
        lng: point.lng,
        z: point.z,
        indoor: { venueId: station.id, pointId: point.id },
      };
    }
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
