import { z } from 'zod';

export const coordinatesSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;
/** Study extent, not an administrative boundary or a claim of coverage at every point. */
export function withinHongKong({ lat, lng }: Coordinates) {
  return lat >= 22.1 && lat <= 22.6 && lng >= 113.8 && lng <= 114.5;
}
export function parseCoordinates(
  text: string,
):
  | { kind: 'text' }
  | { kind: 'invalid'; message: string }
  | { kind: 'coordinates'; location: Coordinates; swapped: boolean; supported: boolean } {
  const value = text
    .trim()
    .replace(/^\((.*)\)$/, '$1')
    .trim();
  const pair = value.match(/^([+-]?\d+(?:\.\d+)?)\s*[,，]\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!pair)
    return /^[\s()+\-\d.,，]+$/.test(value) && /[,，]/.test(value)
      ? { kind: 'invalid', message: 'Enter two decimal numbers: latitude, longitude.' }
      : { kind: 'text' };
  const a = Number(pair[1]),
    b = Number(pair[2]);
  const swapped = Math.abs(a) > 90 && Math.abs(a) <= 180 && Math.abs(b) <= 90;
  const parsed = coordinatesSchema.safeParse(swapped ? { lat: b, lng: a } : { lat: a, lng: b });
  if (!parsed.success)
    return { kind: 'invalid', message: 'Latitude must be within ±90 and longitude within ±180.' };
  return {
    kind: 'coordinates',
    location: parsed.data,
    swapped,
    supported: withinHongKong(parsed.data),
  };
}
export const searchResultSchema = z.object({
  id: z.string().min(1).max(240),
  kind: z.enum(['place', 'station', 'restaurant', 'address', 'coordinate', 'facility']),
  name: z.string().max(1000),
  nameZh: z.string().max(1000).default(''),
  address: z.string().max(3000).default(''),
  addressZh: z.string().max(3000).default(''),
  district: z.string().default(''),
  location: coordinatesSchema.nullable(),
  locationPrecision: z.enum(['reference', 'address', 'user-supplied', 'unresolved']),
  source: z.enum(['curated', 'MTR', 'FEHD', 'LandsD', 'user', 'LCSD', 'AFCD']),
  sourceDate: z.string().nullable().default(null),
  station: z.object({ line: z.string(), station: z.string() }).optional(),
  placeId: z.string().optional(),
  licenceType: z.string().optional(),
  expiryDate: z.string().optional(),
  facility: z
    .object({
      category: z.enum(['sports', 'library', 'refill']),
      dataset: z.string(),
      sourceUrl: z.url(),
      website: z.url().optional(),
      hours: z.string(),
      hoursZh: z.string(),
      details: z.string(),
      detailsZh: z.string(),
      locationNote: z.string(),
      locationNoteZh: z.string(),
      phone: z.string(),
      fetchedAt: z.iso.datetime(),
    })
    .optional(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;
export const catalogueStatusSchema = z.object({
  sourceDate: z.string().nullable(),
  fetchedAt: z.string().nullable(),
  importedAt: z.string().nullable(),
  count: z.number(),
  resolved: z.number(),
  stale: z.boolean(),
});
export type CatalogueStatus = z.infer<typeof catalogueStatusSchema>;
export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  notices: z.array(z.string()),
  catalogue: catalogueStatusSchema,
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export function normalizeSearchText(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/([a-z0-9])(\p{Script=Han})/gu, '$1 $2')
    .replace(/(\p{Script=Han})([a-z0-9])/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export function coordinateResult(location: Coordinates): SearchResult {
  return {
    id: `pin:${location.lat},${location.lng}`,
    kind: 'coordinate',
    name: 'Dropped pin',
    nameZh: '',
    address: `${location.lat}, ${location.lng}`,
    addressZh: '',
    district: '',
    location,
    locationPrecision: 'user-supplied',
    source: 'user',
    sourceDate: null,
  };
}

export const locateResponseSchema = z.object({
  result: searchResultSchema,
  candidates: z.array(searchResultSchema),
  message: z.string(),
});
