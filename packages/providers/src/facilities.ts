import { z } from 'zod';
import {
  coordinatesSchema,
  searchResultSchema,
  withinHongKong,
  type FacilitySnapshot,
  type SearchResult,
  type FacilitiesResponse,
} from '@hk/contracts';
import { fetchJson, type Fetcher } from './http';

export const FACILITY_SOURCES = [
  {
    id: 'lcsd_rcd_1629267205215_31341',
    title: 'LCSD sports centres',
    category: 'sports',
    provider: 'LCSD',
  },
  {
    id: 'lcsd_rcd_1629267205214_44807',
    title: 'LCSD libraries (including mobile stops)',
    category: 'library',
    provider: 'LCSD',
  },
  {
    id: 'lcsd_rcd_1671530248519_33416',
    title: 'LCSD water dispensers',
    category: 'refill',
    provider: 'LCSD',
  },
  {
    id: 'afcd_rcd_1635133835075_48993',
    title: 'AFCD country park filling stations',
    category: 'refill',
    provider: 'AFCD',
  },
] as const;
type Source = (typeof FACILITY_SOURCES)[number];
const featureSchema = z.object({
  geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.record(z.string(), z.unknown()),
});
const pageSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(featureSchema),
  exceededTransferLimit: z.boolean().optional(),
  properties: z.object({ exceededTransferLimit: z.boolean().optional() }).optional(),
});
function text(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const result = String(value)
    .trim()
    .replace(/<[^>]*>/g, '');
  return /^(?:N\.?A\.?|NIL|NULL|-)$/i.test(result) ? '' : result;
}
function officialWebsite(value: unknown) {
  try {
    const url = new URL(text(value));
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      /(?:^|\.)(?:lcsd|hkpl|afcd)\.gov\.hk$/.test(url.hostname) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {
    /* Missing URLs stay absent. */
  }
  return undefined;
}
export function normalizeFacility(source: Source, raw: unknown, fetchedAt: string): SearchResult {
  const feature = featureSchema.parse(raw),
    p = feature.properties;
  const get = (...keys: string[]) => keys.map((key) => text(p[key])).find(Boolean) ?? '';
  const location = coordinatesSchema.parse({
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
  });
  if (!withinHongKong(location)) throw new Error('Facility coordinate outside study extent.');
  const identity = get('FAC_ID', 'OBJECTID');
  const name = get('NameEN', 'Name_of_Building_or_Facility_EN', 'FACILITY_NAME_EN');
  if (!identity || !name) throw new Error('Facility missing identity or name.');
  const hours =
    get('OpeningHoursEN', 'SERVICE_HOUR') ||
    [get('Service_Hours_From'), get('Service_Hours_To')].filter(Boolean).join(' – ');
  const date =
    typeof p.LASTUPDATE === 'number' && Number.isFinite(p.LASTUPDATE)
      ? new Date(p.LASTUPDATE).toISOString()
      : null;
  return searchResultSchema.parse({
    id: `facility:${source.id}:${identity}`,
    kind: 'facility',
    name,
    nameZh: get('NameTC', 'Name_of_Building_or_Facility_TC', 'FACILITY_NAME_TC'),
    address: get('AddressEN', 'Street_EN', 'LOCATION_EN'),
    addressZh: get('AddressTC', 'Street_TC', 'LOCATION_TC'),
    district: get('DistrictEN', 'District_EN', 'COUNTRY_PARK_EN'),
    location,
    locationPrecision: 'reference',
    source: source.provider,
    sourceDate: date,
    facility: {
      category: source.category,
      dataset: source.id,
      sourceUrl: `https://portal.csdi.gov.hk/csdi-webpage/dataset/${source.id}`,
      website: officialWebsite(p.WebsiteEN),
      fetchedAt,
      hours: [hours, get('Service_Hours_Exception_EN')].filter(Boolean).join(' · '),
      hoursZh: [get('OpeningHoursTC') || hours, get('Service_Hours_Exception_TC')]
        .filter(Boolean)
        .join(' · '),
      details: [
        'FacilityTypeEN',
        'LibraryTypeEN',
        'Type_of_Water_Dispenser_EN',
        'TYPE_OF_WATER_DISPENSER_EN',
        'Water_Temperature_EN',
        'WATER_TEMPERATURE_EN',
        'Indoor_Outdoor_EN',
        'TYPE_OF_VENUE_EN',
        'Remarks_EN',
      ]
        .map((key) => get(key))
        .filter(Boolean)
        .join(' · '),
      detailsZh: [
        'FacilityTypeTC',
        'LibraryTypeTC',
        'Type_of_Water_Dispenser_TC',
        'TYPE_OF_WATER_DISPENSER_TC',
        'Water_Temperature_TC',
        'WATER_TEMPERATURE_TC',
        'Indoor_Outdoor_TC',
        'TYPE_OF_VENUE_TC',
        'Remarks_TC',
      ]
        .map((key) => get(key))
        .filter(Boolean)
        .join(' · '),
      locationNote: get('Location_EN', 'LOCATION_EN'),
      locationNoteZh: get('Location_TC', 'LOCATION_TC'),
      phone: get('TelephoneEN'),
    },
  });
}

export async function fetchFacilities(
  source: Source,
  fetcher: Fetcher,
  now = Date.now,
): Promise<FacilitySnapshot> {
  const base = `https://portal.csdi.gov.hk/server/rest/services/common/${source.id}/MapServer/0/query`;
  const count = z
    .object({ count: z.number().int().min(1).max(10000) })
    .parse(
      await fetchJson(`${base}?where=1%3D1&returnCountOnly=true&f=json`, fetcher, {
        timeoutMs: 25000,
      }),
    ).count;
  const fetchedAt = new Date(now()).toISOString();
  const records: SearchResult[] = [];
  for (let offset = 0; offset < count; offset += 100) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      outSR: '4326',
      f: 'geojson',
      orderByFields: 'OBJECTID ASC',
      resultOffset: String(offset),
      resultRecordCount: '100',
    });
    const page = pageSchema.parse(
      await fetchJson(`${base}?${params}`, fetcher, {
        maxBytes: 3 * 1024 * 1024,
        timeoutMs: 25000,
      }),
    );
    records.push(...page.features.map((row) => normalizeFacility(source, row, fetchedAt)));
    if (!page.features.length) throw new Error('Incomplete facility page.');
  }
  if (records.length !== count || new Set(records.map((row) => row.id)).size !== count)
    throw new Error('Incomplete or duplicate facility snapshot.');
  return { dataset: source.id, fetchedAt, records };
}

/** Refresh outside request paths, publishing only complete per-source snapshots. */
export class FacilityCatalogue {
  private snapshots = new Map<string, FacilitySnapshot>();
  private failed = new Set<string>();
  private pending: Promise<void> | undefined;
  private lifetime = new AbortController();
  constructor(
    private fetcher: Fetcher,
    initial: FacilitySnapshot[] = [],
    private now = Date.now,
    private persist?: (snapshot: FacilitySnapshot) => Promise<void>,
  ) {
    for (const snapshot of initial)
      if (FACILITY_SOURCES.some((source) => source.id === snapshot.dataset))
        this.snapshots.set(snapshot.dataset, snapshot);
  }
  data(): FacilitiesResponse {
    return {
      records: [...this.snapshots.values()].flatMap((snapshot) => snapshot.records),
      sources: FACILITY_SOURCES.map((source) => {
        const snapshot = this.snapshots.get(source.id);
        return {
          dataset: source.id,
          title: source.title,
          category: source.category,
          fetchedAt: snapshot?.fetchedAt ?? null,
          count: snapshot?.records.length ?? 0,
          status: !snapshot
            ? 'unavailable'
            : this.failed.has(source.id) ||
                this.now() - Date.parse(snapshot.fetchedAt) > 48 * 3600000
              ? 'stale'
              : 'ready',
        };
      }),
    };
  }
  refresh() {
    if (this.lifetime.signal.aborted) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.update().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  private async update() {
    for (const source of FACILITY_SOURCES) {
      if (this.lifetime.signal.aborted) break;
      const previous = this.snapshots.get(source.id);
      if (
        previous &&
        !this.failed.has(source.id) &&
        this.now() - Date.parse(previous.fetchedAt) < 24 * 3600000
      )
        continue;
      try {
        const snapshot = await fetchFacilities(
          source,
          (url, init) =>
            this.fetcher(url, {
              ...init,
              signal: AbortSignal.any([
                this.lifetime.signal,
                ...(init?.signal ? [init.signal] : []),
              ]),
            }),
          this.now,
        );
        if (previous && snapshot.records.length < previous.records.length / 2)
          throw new Error('Unexpected facility count drop.');
        await this.persist?.(snapshot);
        this.snapshots.set(source.id, snapshot);
        this.failed.delete(source.id);
      } catch {
        this.failed.add(source.id);
      }
    }
  }
  dispose() {
    this.lifetime.abort();
  }
}
