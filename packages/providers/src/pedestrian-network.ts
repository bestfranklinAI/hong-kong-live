import { z } from 'zod';
import {
  pedestrianNetworkSchema,
  withinHongKong,
  type NetworkRequest,
  type PedestrianNetwork,
} from '@hk/contracts';
import { fetchJson, ProviderError, type Fetcher } from './http';

const BASE =
  'https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0/query';
const SOURCE = 'https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1637222018065_52265';
const kinds: Record<number, string> = {
  1: 'Footway',
  2: 'Footbridge',
  4: 'Subway',
  8: 'Escalator',
  10: 'Lift',
  11: 'Ramp',
  12: 'Stairs',
  13: 'Stairlift',
  16: 'Escalator',
  18: 'Lift',
  19: 'Ramp',
  20: 'Stairs',
  21: 'Stairlift',
};
const pageSchema = z.object({
  hasZ: z.boolean().optional(),
  spatialReference: z.object({ wkid: z.literal(4326) }),
  exceededTransferLimit: z.boolean().optional(),
  features: z
    .array(
      z.object({
        attributes: z.object({
          AliasNameEN: z.string().nullable().optional(),
          AliasNameTC: z.string().nullable().optional(),
          OBJECTID: z.number().int(),
          PedestrianRouteID: z.number().int(),
          FeatureType: z.number().int().nullable(),
          WeatherProof: z.number().int().nullable(),
          Enabled: z.number().int().nullable(),
          FloorID: z.union([z.string(), z.number().int()]).nullable(),
          AccessTimeID: z.union([z.string(), z.number().int()]).nullable(),
          LastAmendmentDate: z.number().finite().nullable(),
        }),
        geometry: z.object({
          hasZ: z.boolean().optional(),
          paths: z.array(z.array(z.array(z.number().finite()).min(2).max(4)).min(2)).min(1),
        }),
      }),
    )
    .max(400),
});

/** One published network only: nearby edges are context, not matched route edges or live access. */
export class PedestrianNetworkProvider {
  private cache = new Map<string, { expires: number; value: PedestrianNetwork }>();
  private pending = new Map<string, Promise<PedestrianNetwork>>();
  constructor(
    private fetcher: Fetcher = fetch,
    private now = Date.now,
  ) {}
  private view(value: PedestrianNetwork, category: NetworkRequest['category']): PedestrianNetwork {
    return {
      ...value,
      category,
      segments:
        category === 'cover'
          ? value.segments
          : value.segments.filter((segment) =>
              ['Footbridge', 'Subway', 'Escalator', 'Lift', 'Ramp', 'Stairs', 'Stairlift'].includes(
                segment.kind,
              ),
            ),
    };
  }
  async nearRoute(request: NetworkRequest): Promise<PedestrianNetwork> {
    const key = JSON.stringify(request.paths);
    const cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return this.view(cached.value, request.category);
    const pending = this.pending.get(key);
    if (pending) return this.view(await pending, request.category);
    if (this.pending.size >= 2)
      throw new ProviderError('Path details are busy. Try again shortly.');
    const task = this.load({ ...request, category: 'cover' })
      .then((value) => {
        for (const [key, entry] of this.cache)
          if (entry.expires <= this.now()) this.cache.delete(key);
        if (this.cache.size >= 8) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { expires: this.now() + 6 * 3600000, value });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return this.view(await task, request.category);
  }
  private async load(request: NetworkRequest): Promise<PedestrianNetwork> {
    const segments: PedestrianNetwork['segments'] = [];
    const seen = new Set<number>();
    // The live gateway rejects large form bodies. Overlapping windows retain every route
    // edge without simplifying bends or connecting separate paths.
    const windows = request.paths.flatMap((path) => {
      const parts: typeof request.paths = [];
      for (let i = 0; i < path.length - 1; i += 79) parts.push(path.slice(i, i + 80));
      return parts;
    });
    const deadline = Date.now() + 25000;
    let partial = false,
      vertices = 0,
      window = 0,
      page = 0;
    for (let call = 0; call < 6 && window < windows.length; call++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        partial = true;
        break;
      }
      const query = new URLSearchParams({
        f: 'json',
        // The public gateway rejects the IN filter; apply the domain filter to validated records.
        where: '1=1',
        geometry: JSON.stringify({ paths: [windows[window]], spatialReference: { wkid: 4326 } }),
        geometryType: 'esriGeometryPolyline',
        inSR: '4326',
        outSR: '4326',
        distance: '50',
        units: 'esriSRUnit_Meter',
        spatialRel: 'esriSpatialRelIntersects',
        outFields:
          'OBJECTID,PedestrianRouteID,FeatureType,WeatherProof,Enabled,FloorID,AccessTimeID,LastAmendmentDate,AliasNameEN,AliasNameTC',
        returnGeometry: 'true',
        returnZ: 'true',
        returnM: 'false',
        resultOffset: String(page * 400),
        resultRecordCount: '400',
        orderByFields: 'OBJECTID ASC',
      });
      const raw = await fetchJson(
        BASE,
        (url, init) =>
          this.fetcher(url, {
            ...init,
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: query.toString(),
          }),
        { maxBytes: 4 * 1024 * 1024, timeoutMs: Math.min(8000, remaining) },
      );
      const parsed = pageSchema.safeParse(raw);
      if (!parsed.success) throw new ProviderError('Nearby path data is unavailable. Try again.');
      const data = parsed.data;
      for (const { attributes: a, geometry } of data.features) {
        if (seen.has(a.OBJECTID)) continue;
        seen.add(a.OBJECTID);
        vertices += geometry.paths.reduce((sum, path) => sum + path.length, 0);
        if (vertices > 60000 || segments.length >= 1200) {
          partial = true;
          break;
        }
        const paths = geometry.paths.map((path) =>
          path.map((p) => {
            if (!withinHongKong({ lng: p[0], lat: p[1] }))
              throw new ProviderError('Invalid nearby path coordinates.');
            return [
              p[0],
              p[1],
              (geometry.hasZ ?? data.hasZ ?? false) && p.length >= 3 ? p[2] : null,
            ] as [number, number, number | null];
          }),
        );
        const amended = a.LastAmendmentDate === null ? null : new Date(a.LastAmendmentDate);
        segments.push({
          id: String(a.PedestrianRouteID),
          kind: kinds[a.FeatureType ?? -1] ?? 'Path',
          ...(a.AliasNameEN?.trim() ? { name: a.AliasNameEN.trim() } : {}),
          ...(a.AliasNameTC?.trim() ? { nameZh: a.AliasNameTC.trim() } : {}),
          paths,
          cover: a.WeatherProof === 1 ? 'covered' : a.WeatherProof === 2 ? 'uncovered' : 'unknown',
          enabled: a.Enabled === 1 ? true : a.Enabled === 2 ? false : null,
          floorId: a.FloorID === null ? null : String(a.FloorID),
          accessTimeId: a.AccessTimeID === null ? null : String(a.AccessTimeID),
          amendedAt: amended && Number.isFinite(amended.getTime()) ? amended.toISOString() : null,
        });
      }
      if (vertices > 60000 || segments.length >= 1200) {
        partial = true;
        break;
      }
      if (!data.exceededTransferLimit) {
        window++;
        page = 0;
      } else if (++page >= 3) {
        partial = true;
        window++;
        page = 0;
      }
    }
    if (window < windows.length) partial = true;
    return pedestrianNetworkSchema.parse({
      segments,
      partial,
      category: request.category,
      corridorM: 50,
      fetchedAt: new Date(this.now()).toISOString(),
      sourceUrl: SOURCE,
      heightDatum: 'HKPD',
    });
  }
}
