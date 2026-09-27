import { z } from 'zod';
import { indoorLayoutFeatureSchema, withinHongKong, type IndoorLayoutFeature } from '@hk/contracts';
import { ProviderError } from './http';
/** Fixed source layers only. Door geometry does not establish permission or traversability. */
export function normalizeIndoorLayout(
  raw: unknown,
  venueId: string,
  kind: 'unit' | 'opening',
): IndoorLayoutFeature[] {
  const collection = z
    .object({
      features: z
        .array(
          z.object({
            properties: z.record(z.string(), z.unknown()),
            geometry: z.object({ type: z.string(), coordinates: z.unknown() }),
          }),
        )
        .max(4999),
    })
    .parse(raw);
  let vertices = 0;
  const result = collection.features.map(({ properties: p, geometry: g }) => {
    if (p.venue_id !== venueId) throw new ProviderError('Indoor layout returned another station.');
    const polygon = kind === 'unit';
    if (
      !(polygon ? ['Polygon', 'MultiPolygon'] : ['LineString', 'MultiLineString']).includes(g.type)
    )
      throw new ProviderError('Unsupported indoor layout geometry.');
    const lines =
      g.type === 'MultiPolygon'
        ? z.array(z.array(z.unknown())).parse(g.coordinates).flat()
        : g.type === 'LineString'
          ? [g.coordinates]
          : g.coordinates;
    const row = indoorLayoutFeatureSchema.parse({
      id: String(p[`${kind}_id`]).toLowerCase(),
      venueId,
      levelId: p.level_id,
      category: typeof p[`${kind}_category`] === 'string' ? p[`${kind}_category`] : 'unspecified',
      name:
        typeof p[`${kind}_name_en`] === 'string'
          ? p[`${kind}_name_en`]
          : typeof p.opening_name === 'string'
            ? p.opening_name
            : '',
      z: p.level_z_value,
      lines,
    });
    for (const line of row.lines) {
      vertices += line.length;
      if (vertices > 100000) throw new ProviderError('Indoor layout is too large.');
      if (polygon && (line.length < 4 || line[0].some((v, i) => v !== line.at(-1)![i])))
        throw new ProviderError('Indoor unit boundary is not closed.');
      if (
        line.some(
          ([lng, lat, height]) => !withinHongKong({ lng, lat }) || Math.abs(height - row.z) > 0.25,
        )
      )
        throw new ProviderError('Indoor layout does not match its source level.');
    }
    return row;
  });
  if (new Set(result.map((r) => r.id)).size !== result.length)
    throw new ProviderError('Duplicate indoor layout identifiers.');
  return result;
}
