import { z } from 'zod';
import { withinHongKong, type Coordinates } from '@hk/contracts';
import { fetchJson, type Fetcher } from './http';

export const RESTAURANT_LOCATION_URL =
  'https://portal.csdi.gov.hk/server/rest/services/common/fehd_rcd_1630036390312_58893/MapServer/0';
export interface RestaurantLocation {
  id: string;
  address: string;
  location: Coordinates;
  sourceDate: string | null;
}
const featureSchema = z.object({
  geometry: z
    .object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number().finite(), z.number().finite()]),
    })
    .nullable(),
  properties: z.object({
    OBJECTID: z.number().int().nonnegative(),
    SEARCH02_EN: z.string().regex(/^\d+$/),
    ADDRESS_EN: z.string().min(1),
    LASTUPDATE: z.string().nullable(),
  }),
});

export function normalizeRestaurantLocation(raw: unknown): RestaurantLocation | undefined {
  const feature = featureSchema.parse(raw);
  if (!feature.geometry) return undefined;
  const [lng, lat] = feature.geometry.coordinates;
  if (!withinHongKong({ lat, lng })) return undefined;
  const date = feature.properties.LASTUPDATE;
  return {
    id: `fehd:${feature.properties.SEARCH02_EN}`,
    address: feature.properties.ADDRESS_EN,
    location: { lat, lng },
    sourceDate: date ? z.iso.date().parse(date) : null,
  };
}

/** Published reference points join by licence and address; this does not geocode names or infer entrances. */
export async function fetchRestaurantLocations(fetcher: Fetcher, now = Date.now) {
  // Independently cached query URLs can expose counts and pages from different daily snapshots.
  // Keep one nonce for this bounded import and still reject any count/identity mismatch.
  const importKey = String(now());
  const countQuery = new URLSearchParams({
    where: '1=1',
    returnCountOnly: 'true',
    f: 'json',
    _hk_import: importKey,
  });
  const count = z
    .object({ count: z.number().int().min(1000).max(100000) })
    .parse(
      await fetchJson(`${RESTAURANT_LOCATION_URL}/query?${countQuery}`, fetcher, {
        timeoutMs: 25000,
      }),
    ).count;
  const records = new Map<string, RestaurantLocation>();
  const ids = new Set<number>();
  const ambiguous = new Set<string>();
  let received = 0;
  for (let offset = 0; offset < count; offset += 2000) {
    const query = new URLSearchParams({
      where: '1=1',
      outFields: 'OBJECTID,SEARCH02_EN,ADDRESS_EN,LASTUPDATE',
      outSR: '4326',
      f: 'geojson',
      orderByFields: 'OBJECTID ASC',
      resultOffset: String(offset),
      resultRecordCount: '2000',
      _hk_import: importKey,
    });
    const page = z
      .object({ type: z.literal('FeatureCollection'), features: z.array(featureSchema).max(2000) })
      .parse(
        await fetchJson(`${RESTAURANT_LOCATION_URL}/query?${query}`, fetcher, {
          timeoutMs: 25000,
          maxBytes: 2 * 1024 * 1024,
        }),
      );
    if (!page.features.length) throw new Error('Incomplete restaurant point publication.');
    received += page.features.length;
    for (const feature of page.features) {
      const id = feature.properties.OBJECTID;
      if (ids.has(id)) throw new Error('Duplicate restaurant point in publication.');
      ids.add(id);
      const record = normalizeRestaurantLocation(feature);
      if (!record || ambiguous.has(record.id)) continue;
      const previous = records.get(record.id);
      if (
        previous &&
        (previous.address !== record.address ||
          previous.location.lat !== record.location.lat ||
          previous.location.lng !== record.location.lng)
      ) {
        // Some licences have multiple point rows. Withhold conflicting locations instead of choosing one.
        records.delete(record.id);
        ambiguous.add(record.id);
      } else records.set(record.id, record);
    }
  }
  if (received !== count) throw new Error('Incomplete restaurant point publication.');
  return {
    fetchedAt: new Date(now()).toISOString(),
    records: [...records.values()],
    publishedCount: count,
    ambiguousLicences: ambiguous.size,
  };
}
