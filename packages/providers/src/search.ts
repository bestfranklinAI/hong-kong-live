import { XMLParser, XMLValidator } from 'fast-xml-parser';
import proj4 from 'proj4';
import { z } from 'zod';
import { normalizeSearchText, withinHongKong, type SearchResult } from '@hk/contracts';
import { fetchJson, type Fetcher } from './http';

export const FEHD_URLS = {
  en: 'https://www.fehd.gov.hk/english/licensing/license/text/LP_Restaurants_EN.XML',
  tc: 'https://www.fehd.gov.hk/tc_chi/licensing/license/text/LP_Restaurants_TC.XML',
};
export const LANDSD_SEARCH_URL = 'https://www.map.gov.hk/gs/api/v1.0.0/locationSearch';
export async function fetchCatalogueXml(url: string, fetcher: Fetcher): Promise<string> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error('Catalogue download unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '',
    size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 24 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Catalogue exceeds size limit.');
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
const licenceSchema = z.object({
  TYPE: z.enum(['RL', 'RR', 'MR']),
  DIST: z.string(),
  LICNO: z.string().regex(/^\d+$/),
  SS: z.string(),
  ADR: z.string().min(1),
  EXPDATE: z.string(),
});
export function parseFehd(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true)
    throw new Error('Invalid catalogue XML.');
  const raw = new XMLParser({
    parseTagValue: false,
    ignoreAttributes: false,
    isArray: (name) => name === 'LP' || name === 'CODE',
  }).parse(xml);
  const data = z
    .object({
      DATA: z.object({
        GENERATION_DATE: z.iso.date(),
        LPS: z.object({ LP: z.array(licenceSchema).min(1).max(100000) }),
        DIST_CODE: z.object({
          CODE: z.array(z.object({ '@_ID': z.string(), '#text': z.string() })),
        }),
      }),
    })
    .parse(raw).DATA;
  const ids = new Set(data.LPS.LP.map((row) => row.LICNO));
  if (ids.size !== data.LPS.LP.length) throw new Error('Duplicate licence identifiers.');
  return {
    date: data.GENERATION_DATE,
    rows: data.LPS.LP,
    districts: Object.fromEntries(data.DIST_CODE.CODE.map((row) => [row['@_ID'], row['#text']])),
  };
}
export function mergeFehd(
  english: string,
  chinese: string,
): { date: string; records: SearchResult[] } {
  const en = parseFehd(english),
    tc = parseFehd(chinese);
  if (en.date !== tc.date || en.rows.length !== tc.rows.length)
    throw new Error('Language snapshots do not match.');
  const translated = new Map(tc.rows.map((row) => [row.LICNO, row]));
  return {
    date: en.date,
    records: en.rows.map((row) => {
      const zh = translated.get(row.LICNO);
      if (!zh || zh.TYPE !== row.TYPE || zh.DIST !== row.DIST)
        throw new Error('Language identifiers do not match.');
      return {
        id: `fehd:${row.LICNO}`,
        kind: 'restaurant',
        name: row.SS || zh.SS || 'Licensed restaurant',
        nameZh: zh.SS,
        address: row.ADR,
        addressZh: zh.ADR,
        district: `${en.districts[row.DIST] ?? row.DIST} ${tc.districts[row.DIST] ?? ''}`,
        location: null,
        locationPrecision: 'unresolved',
        source: 'FEHD',
        sourceDate: en.date,
        licenceType: row.TYPE,
        expiryDate: row.EXPDATE,
      };
    }),
  };
}
// EPSG:2326 Hong Kong 1980 Grid to WGS84. The source x/y are metres, not longitude/latitude.
const HK80 =
  '+proj=tmerc +lat_0=22.31213333333334 +lon_0=114.1785555555556 +k=1 +x_0=836694.05 +y_0=819069.8 +ellps=intl +towgs84=-162.619,-276.959,-161.764,0.067753,-2.243648,-1.158828,-1.094246 +units=m +no_defs';
const landsdSchema = z
  .array(
    z.object({
      nameEN: z.string(),
      nameZH: z.string(),
      addressEN: z.string(),
      addressZH: z.string(),
      districtEN: z.string(),
      districtZH: z.string(),
      x: z.number().finite(),
      y: z.number().finite(),
    }),
  )
  .max(500);
export async function fetchLandsd(query: string, fetcher: Fetcher): Promise<SearchResult[]> {
  const raw = await fetchJson(
    `${LANDSD_SEARCH_URL}?${new URLSearchParams({ q: query })}`,
    fetcher,
    { maxBytes: 2 * 1024 * 1024, timeoutMs: 8000 },
  );
  const seen = new Set<string>();
  return landsdSchema.parse(raw).flatMap((row) => {
    const [lng, lat] = proj4(HK80, 'EPSG:4326', [row.x, row.y]);
    const id = `landsd:${row.x}:${row.y}:${row.nameEN.slice(0, 120)}`;
    if (!withinHongKong({ lng, lat }) || seen.has(id)) return [];
    seen.add(id);
    return [
      {
        id,
        kind: 'address',
        name: row.nameEN || row.nameZH || row.addressEN || row.addressZH || 'Address location',
        nameZh: row.nameZH || row.addressZH,
        address: row.addressEN,
        addressZh: row.addressZH,
        district: row.districtEN,
        location: { lng, lat },
        locationPrecision: 'reference',
        source: 'LandsD',
        sourceDate: null,
      } as SearchResult,
    ];
  });
}
/** Only a unique, explicitly matching numbered address can automatically locate a licence. */
export function matchRestaurantAddress(
  restaurant: SearchResult,
  candidates: SearchResult[],
): SearchResult | undefined {
  const address = normalizeSearchText(restaurant.address);
  const matches = candidates.filter((row) => {
    const candidate = normalizeSearchText(row.address);
    return (
      row.location &&
      /\d/.test(candidate) &&
      candidate.length >= 12 &&
      ` ${address} `.includes(` ${candidate} `)
    );
  });
  const locations = new Map(
    matches.map((row) => [`${row.location!.lat.toFixed(5)},${row.location!.lng.toFixed(5)}`, row]),
  );
  return locations.size === 1 ? [...locations.values()][0] : undefined;
}
/** Discard shop/floor prefixes for lookup, but preserve the original address for matching and display. */
export function restaurantAddressQuery(address: string) {
  const parts = address.split(',').map((s) => s.trim());
  while (
    parts.length > 1 &&
    /^(?:SHOP|UNIT|STALL|ROOM|FLAT|GROUND FLOOR|G\/F|[\d\s-]+(?:ST|ND|RD|TH)? FLOOR|LEVEL|BASEMENT)/i.test(
      parts[0],
    )
  )
    parts.shift();
  return parts.join(', ').slice(0, 200);
}
