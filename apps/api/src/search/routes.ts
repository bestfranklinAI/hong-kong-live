import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  places,
  mtrStations,
  mtrLines,
  mtrStationLocations,
  normalizeSearchText,
  parseCoordinates,
  coordinateResult,
  isMapLinkInput,
  MAP_LINK_MAX_LENGTH,
  type SearchResult,
  type SearchResponse,
  type DataMode,
} from '@hk/contracts';
import {
  matchRestaurantAddress,
  restaurantAddressQuery,
  resolveGoogleMapsLink,
  allowedMapUrl,
  type Fetcher,
} from '@hk/providers';
import { emptyRepository, rankResult, type SearchRepository } from './repository';
import type { LandsdSearch } from './landsd';

const localResults: SearchResult[] = [
  ...places
    .filter((p) => !p.station)
    .map((p) => ({
      id: `curated:${p.id}`,
      placeId: p.id,
      kind: 'place' as const,
      name: p.name,
      nameZh: p.nameZh,
      address: '',
      addressZh: '',
      district: p.district,
      location: { lat: p.lat, lng: p.lng },
      locationPrecision: 'reference' as const,
      source: 'curated' as const,
      sourceDate: null,
    })),
  ...Object.entries(mtrStations).map(([code, station]) => ({
    id: `mtr:${code}`,
    kind: 'station' as const,
    ...station,
    address: '',
    addressZh: '',
    district: '',
    location: mtrStationLocations[code] ?? null,
    locationPrecision: mtrStationLocations[code] ? ('reference' as const) : ('unresolved' as const),
    source: 'MTR' as const,
    sourceDate: null,
    station: { line: mtrLines.find((line) => line.stations.includes(code))!.code, station: code },
  })),
];
export function searchRoutes(
  repository: SearchRepository = emptyRepository,
  landsd?: LandsdSearch,
  mode: DataMode = 'live',
  now = Date.now,
  fetcher: Fetcher = fetch,
  facilities?: import('@hk/providers').FacilityCatalogue,
) {
  const app = new Hono();
  let windowAt = now(),
    requests = 0;
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store'); // Queries can contain user-supplied coordinates.
    if (now() - windowAt >= 60000) {
      windowAt = now();
      requests = 0;
    }
    if (++requests > 120) {
      c.header('Retry-After', '60');
      return c.json({ error: 'Search is busy. Try again shortly.' }, 429);
    }
    await next();
  });
  app.get('/', async (c) => {
    const q = (c.req.query('q') ?? '').trim();
    const rawLimit = c.req.query('limit') ?? '10';
    const language = c.req.query('language') ?? 'en';
    if (
      q.length < 1 ||
      q.length > 200 ||
      !/^\d{1,2}$/.test(rawLimit) ||
      +rawLimit < 1 ||
      +rawLimit > 20 ||
      !['en', 'tc'].includes(language)
    )
      return c.json({ error: 'Enter a search of 1–200 characters and a limit of 1–20.' }, 400);
    const limit = +rawLimit;
    const response: SearchResponse = {
      results: [],
      notices: [],
      catalogue: repository.status(now()),
    };
    if (isMapLinkInput(q)) {
      response.notices.push(
        'Paste the Maps link in the search box and choose Resolve Google Maps link.',
      );
      return c.json(response);
    }
    if (/^nearby:/i.test(q)) {
      const parsed = parseCoordinates(q.replace(/^nearby:/i, ''));
      if (parsed.kind !== 'coordinates' || !parsed.supported || parsed.swapped)
        return c.json({ error: 'Nearby search needs Hong Kong latitude, longitude.' }, 400);
      const { lat, lng } = parsed.location;
      const distance = (row: SearchResult) =>
        row.location
          ? Math.hypot(
              (row.location.lng - lng) * Math.cos((lat * Math.PI) / 180),
              row.location.lat - lat,
            ) * 111195
          : Infinity;
      response.results = [
        ...localResults,
        ...(facilities?.data().records ?? []),
        ...repository.nearby(lat, lng, 100),
      ]
        .filter((row) => distance(row) <= 2000)
        .sort((a, b) => distance(a) - distance(b))
        .slice(0, limit);
      response.notices.push(
        'Within about 2 km · only places with known coordinates. Unresolved restaurants are not included.',
      );
      return c.json(response);
    }
    const coordinate = parseCoordinates(q);
    if (coordinate.kind === 'invalid') {
      response.notices.push(coordinate.message);
      return c.json(response);
    }
    if (coordinate.kind === 'coordinates') {
      if (!coordinate.supported)
        response.notices.push('These coordinates are outside the Hong Kong study area.');
      else {
        response.results.push(coordinateResult(coordinate.location));
        if (coordinate.swapped)
          response.notices.push(
            'Longitude was entered first. Select the result to use the suggested latitude, longitude order.',
          );
      }
      return c.json(response);
    }
    const tokens = normalizeSearchText(q).split(' ').filter(Boolean);
    if (!tokens.length) return c.json(response);
    const locals = [...localResults, ...(facilities?.data().records ?? [])].filter((row) => {
      const haystack = normalizeSearchText(
        [
          row.name,
          row.nameZh,
          row.id,
          row.district,
          row.address,
          row.addressZh,
          row.facility?.details,
          row.facility?.detailsZh,
        ].join(' '),
      );
      return tokens.every((token) => haystack.includes(token));
    });
    const restaurants = repository.search(q, 200);
    response.results = [...locals, ...restaurants];
    if (!response.catalogue.count)
      response.notices.push(
        mode === 'fixture'
          ? 'Restaurant catalogue is not recorded in fixture mode.'
          : 'Restaurant catalogue is preparing or unavailable. Address search is still available.',
      );
    else if (response.catalogue.stale)
      response.notices.push('Using the last available restaurant catalogue.');
    // Avoid sending every keystroke to LandsD when the local catalogue already answers it.
    if (response.results.length < 3 && q.length >= 2) {
      if (landsd && mode === 'live') {
        try {
          response.results.push(...(await landsd.search(q)));
        } catch {
          response.notices.push(
            'Address lookup is temporarily unavailable; local results are shown.',
          );
        }
      } else response.notices.push('External address lookup is disabled in this environment.');
    }
    response.results.sort(
      (a, b) =>
        rankResult(b, q) - rankResult(a, q) ||
        (language === 'tc'
          ? a.nameZh.localeCompare(b.nameZh, 'zh-Hant')
          : a.name.localeCompare(b.name)),
    );
    response.results = response.results.slice(0, limit);
    return c.json(response);
  });
  app.get('/facilities', (c) => c.json(facilities?.data() ?? { records: [], sources: [] }));
  let linkRequests = 0;
  let linkWindow = now();
  let activeLinks = 0;
  app.post('/links/resolve', bodyLimit({ maxSize: 16384 }), async (c) => {
    let url: string;
    try {
      const body: unknown = await c.req.json();
      if (
        !body ||
        typeof body !== 'object' ||
        !('url' in body) ||
        typeof body.url !== 'string' ||
        body.url.length > MAP_LINK_MAX_LENGTH
      )
        return c.json({ error: 'Provide a Google Maps link of at most 8192 characters.' }, 400);
      url = allowedMapUrl(body.url.trim()).href;
    } catch {
      return c.json({ error: 'Paste a supported Google Maps HTTPS link.' }, 400);
    }
    if (mode !== 'live')
      return c.json({
        result: null,
        coordinateKind: null,
        message: 'Shared-link resolution is disabled in fixture mode.',
      });
    if (now() - linkWindow >= 60000) {
      linkWindow = now();
      linkRequests = 0;
    }
    if (activeLinks >= 4 || ++linkRequests > 20) {
      c.header('Retry-After', '60');
      return c.json({ error: 'Link resolution is busy. Try again shortly.' }, 429);
    }
    activeLinks++;
    try {
      return c.json(await resolveGoogleMapsLink(url, fetcher));
    } catch {
      return c.json({
        result: null,
        coordinateKind: null,
        message:
          'The map link could not be resolved safely or Google did not respond. Paste the full Maps URL or latitude, longitude instead.',
      });
    } finally {
      activeLinks--;
    }
  });
  app.post('/restaurants/:id/locate', async (c) => {
    const id = c.req.param('id');
    if (!/^fehd:\d{1,20}$/.test(id))
      return c.json({ error: 'Invalid restaurant identifier.' }, 400);
    const row = repository.get(id);
    if (!row) return c.json({ error: 'Restaurant is not in the current catalogue.' }, 404);
    if (row.location)
      return c.json({
        result: row,
        candidates: [],
        message: 'Approximate address location, not a surveyed entrance.',
      });
    if (!landsd || mode !== 'live')
      return c.json({ result: row, candidates: [], message: 'Address lookup is unavailable.' });
    try {
      const candidates = await landsd.search(restaurantAddressQuery(row.address));
      const match = matchRestaurantAddress(row, candidates);
      repository.locate(row.id, row.address, match, now());
      return c.json({
        result: repository.get(row.id) ?? row,
        candidates: match ? [] : candidates.slice(0, 5),
        message: match
          ? 'Approximate address location, not a surveyed entrance.'
          : 'No confident match. Possible address results below are not confirmed restaurant locations.',
      });
    } catch {
      return c.json({
        result: row,
        candidates: [],
        message: 'Address lookup is temporarily unavailable. You can paste coordinates instead.',
      });
    }
  });
  return app;
}
