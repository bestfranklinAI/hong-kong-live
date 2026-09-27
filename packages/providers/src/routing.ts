import { z } from 'zod';
import {
  walkingRouteSchema,
  withinHongKong,
  type WalkingRoute,
  type RouteRequest,
} from '@hk/contracts';
import { fetchJson, ProviderError, type Fetcher } from './http';
const BASE = 'https://mapapi.hkmapservice.gov.hk/PedRoute/NAServer/route';
export const ROUTING_SOURCE_URL =
  'https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search';
const names = {
  recommended: 'Recommended Path',
  shortest: 'Shortest Path',
  'barrier-free': 'Barrier Free Path',
};
const point = z.array(z.number().finite()).min(2).max(4);
const responseSchema = z.object({
  routes: z.object({
    hasZ: z.boolean().optional(),
    spatialReference: z.object({ wkid: z.literal(4326) }),
    features: z
      .array(
        z.object({
          attributes: z.object({
            Total_Length: z.number().finite().nonnegative(),
            Total_Time: z.number().finite().nonnegative(),
          }),
          geometry: z.object({
            hasZ: z.boolean().optional(),
            paths: z.array(z.array(point).min(2)).min(1),
          }),
        }),
      )
      .length(1),
  }),
  directions: z
    .array(
      z.object({
        features: z.array(
          z.object({
            attributes: z.object({
              text: z.string(),
              length: z.number().finite().nonnegative(),
              time: z.number().finite().nonnegative(),
            }),
          }),
        ),
      }),
    )
    .min(1),
});
export function horizontalDistance(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function normalizeWalkingRoute(
  raw: unknown,
  request: RouteRequest,
  now: number,
): WalkingRoute {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success)
    throw new ProviderError('No usable walking route was returned. Try a nearby public entrance.');
  const { routes, directions } = parsed.data;
  const route = routes.features[0];
  const hasZ = route.geometry.hasZ ?? routes.hasZ ?? false;
  const paths = route.geometry.paths.map((path) =>
    path.map((p) => {
      if (!withinHongKong({ lng: p[0], lat: p[1] }))
        throw new ProviderError('Route geometry is outside the supported area.');
      // ArcGIS may return XYM or XYZM. M is not elevation.
      return [p[0], p[1], hasZ && p.length >= 3 ? p[2] : null] as [number, number, number | null];
    }),
  );
  const first = paths[0][0],
    last = paths.at(-1)!.at(-1)!;
  for (const [endpoint, point] of [
    [request.start, first],
    [request.end, last],
  ] as const) {
    if (
      endpoint.indoor &&
      (endpoint.z === undefined || point[2] === null || Math.abs(endpoint.z - point[2]) > 1)
    )
      throw new ProviderError(
        'The route did not connect at the selected indoor height. Choose another mapped point on that level.',
      );
  }
  const offsets: [number, number] = [
    horizontalDistance(request.start, { lng: first[0], lat: first[1] }),
    horizontalDistance(request.end, { lng: last[0], lat: last[1] }),
  ];
  if (offsets.some((value) => value > 150))
    throw new ProviderError(
      'The route connects too far from a selected point. Choose a nearer public entrance.',
    );
  return walkingRouteSchema.parse({
    request,
    paths,
    distanceM: route.attributes.Total_Length,
    durationMinutes: route.attributes.Total_Time,
    steps: directions[0].features.map(({ attributes: a }) => ({
      text: a.text,
      distanceM: a.length,
      durationMinutes: a.time,
    })),
    endpointOffsetsM: offsets,
    fetchedAt: new Date(now).toISOString(),
    sourceUpdatedAt: null,
    sourceUrl: ROUTING_SOURCE_URL,
    warnings: [
      'Planning preview, not live navigation. Confirm the entrance and level before walking.',
      'The map line is a ground projection. Source heights are preserved; their vertical datum is not yet verified.',
      'Lift operation, closures and access hours are not verified. Source update time is not supplied.',
      ...(request.profile === 'barrier-free'
        ? ['Official barrier-free routing is not a guarantee of current wheelchair access.']
        : []),
      ...(offsets.some((x) => x > 20)
        ? [
            'A selected point is offset from the network. The gap is not a verified walking connection.',
          ]
        : []),
    ],
  });
}
/** Short-lived bounded cache: precise journey coordinates are never persisted. */
export class WalkingRouter {
  private modes?: { expires: number; values: { name: string; id: string }[] };
  private modesPending?: Promise<{ name: string; id: string }[]>;
  private cache = new Map<string, { expires: number; route: WalkingRoute }>();
  private pending = new Map<string, Promise<WalkingRoute>>();
  constructor(
    private fetcher: Fetcher = fetch,
    private now = Date.now,
  ) {}
  private async travelModes() {
    if (this.modes && this.modes.expires > this.now()) return this.modes.values;
    if (this.modesPending) return this.modesPending;
    this.modesPending = (async () => {
      const raw = await fetchJson(`${BASE}/retrieveTravelModes?f=json`, this.fetcher);
      const data = z
        .object({ supportedTravelModes: z.array(z.object({ name: z.string(), id: z.string() })) })
        .parse(raw);
      this.modes = { expires: this.now() + 86400000, values: data.supportedTravelModes };
      return data.supportedTravelModes;
    })().finally(() => {
      this.modesPending = undefined;
    });
    return this.modesPending;
  }
  async route(request: RouteRequest): Promise<WalkingRoute> {
    if (horizontalDistance(request.start, request.end) > 15000)
      throw new ProviderError(
        'This walking preview supports trips within 15 km straight-line distance.',
      );
    const key = JSON.stringify(request),
      cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return cached.route;
    const current = this.pending.get(key);
    if (current) return current;
    if (this.pending.size >= 4)
      throw new ProviderError('Routing is busy. Please try again shortly.');
    const task = (async () => {
      const mode = (await this.travelModes()).find((m) => m.name === names[request.profile]);
      if (!mode) throw new ProviderError('The requested route profile is unavailable.');
      const stops = {
        features: [request.start, request.end].map((p) => ({
          attributes: { Name: p.name },
          geometry: {
            spatialReference: { wkid: 4326 },
            x: p.lng,
            y: p.lat,
            ...(p.z === undefined ? {} : { z: p.z }),
          },
        })),
      };
      const query = new URLSearchParams({
        stops: JSON.stringify(stops),
        travelMode: mode.id,
        f: 'json',
        returnZ: 'true',
        outSR: '4326',
        directionsLanguage: request.language,
        directionsLengthUnits: 'esriNAUMeters',
        directionsStyleName: 'NA Campus',
      });
      const raw = await fetchJson(`${BASE}/solve?${query}`, this.fetcher, {
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 15000,
      });
      const route = normalizeWalkingRoute(raw, request, this.now());
      for (const [k, v] of this.cache) if (v.expires <= this.now()) this.cache.delete(k);
      if (this.cache.size >= 64) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: this.now() + 30000, route });
      return route;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }
}
