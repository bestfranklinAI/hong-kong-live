import {
  coordinateResult,
  coordinatesSchema,
  MAP_LINK_MAX_LENGTH,
  withinHongKong,
  type MapLinkResponse,
  type Coordinates,
} from '@hk/contracts';
import type { Fetcher } from './http';

const googleHosts = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'google.com.hk',
  'www.google.com.hk',
  'maps.google.com.hk',
]);
const shortHosts = new Set(['maps.app.goo.gl', 'goo.gl']);
const fallback =
  'This link does not expose a single place coordinate. In Google Maps, drop a pin and copy its latitude, longitude instead.';
const empty = (message: string): MapLinkResponse => ({
  result: null,
  coordinateKind: null,
  message,
});

/** Exact hosts and Maps-only paths, checked again before every redirect request. */
export function allowedMapUrl(input: string): URL {
  if (
    input.length > MAP_LINK_MAX_LENGTH ||
    [...input].some((char) => char.charCodeAt(0) <= 32 || char === '\\')
  )
    throw new Error('Paste a complete Google Maps HTTPS link, without extra text.');
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Paste a complete Google Maps HTTPS link.');
  }
  const path = url.pathname;
  const allowedPath = googleHosts.has(url.hostname)
    ? /^\/maps(?:\/|$)/.test(path) || (url.hostname.startsWith('maps.') && path === '/')
    : url.hostname === 'maps.app.goo.gl'
      ? /^\/[A-Za-z0-9_-]+\/?$/.test(path)
      : url.hostname === 'goo.gl' && /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(path);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedPath)
    throw new Error('Only supported Google Maps HTTPS links are accepted.');
  url.hash = '';
  return url;
}

function pair(value: string | null): Coordinates | null {
  const match = value?.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const parsed = coordinatesSchema.safeParse({ lat: Number(match[1]), lng: Number(match[2]) });
  return parsed.success ? parsed.data : null;
}

export function coordinatesFromMapUrl(url: URL): MapLinkResponse {
  // Routes may contain origin, destination and waypoints: never silently pick one.
  if (
    /\/dir(?:\/|$)/.test(url.pathname) ||
    ['origin', 'destination', 'saddr', 'daddr'].some((key) => url.searchParams.has(key))
  )
    return empty('This is a directions link. Share one place or paste its coordinates instead.');
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return empty(fallback);
  }
  let location: Coordinates | null = null;
  let kind: 'place' | 'map-centre' = 'place';
  // Embedded !3d/!4d is an observed share-link format, not a guaranteed Google API.
  const data = `${path} ${url.searchParams.get('data') ?? ''}`;
  const positions = [
    ...data.matchAll(/!3d([+-]?\d+(?:\.\d+)?)!4d([+-]?\d+(?:\.\d+)?)(?=!|\/|\s|$)/g),
  ].map((match) => pair(`${match[1]},${match[2]}`));
  const unique = new Map(
    positions.filter((p): p is Coordinates => p !== null).map((p) => [`${p.lat},${p.lng}`, p]),
  );
  if (positions.some((p) => p === null) || unique.size > 1) return empty(fallback);
  location = unique.values().next().value ?? null;
  if (!location) {
    const queries = ['query', 'q'].flatMap((key) => url.searchParams.getAll(key));
    const points = queries.map(pair).filter((p): p is Coordinates => p !== null);
    const distinct = new Map(points.map((p) => [`${p.lat},${p.lng}`, p]));
    if (distinct.size > 1) return empty(fallback);
    location = distinct.values().next().value ?? null;
    // A place ID can override a query's coordinates. Do not claim these identify that place.
    if (location && (url.searchParams.has('query_place_id') || url.searchParams.has('place_id'))) {
      kind = 'map-centre';
    }
    if (!location && queries.some(Boolean)) return empty(fallback);
  }
  if (!location) {
    const centre = path.match(/@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?),/);
    location = centre
      ? pair(`${centre[1]},${centre[2]}`)
      : pair(url.searchParams.get('center') ?? url.searchParams.get('ll'));
    kind = 'map-centre';
  }
  if (!location) return empty(fallback);
  if (!withinHongKong(location))
    return empty('The coordinates in this link are outside the Hong Kong study area.');
  return {
    result: {
      ...coordinateResult(location),
      name: kind === 'place' ? 'Shared map pin' : 'Shared map centre',
    },
    coordinateKind: kind,
    message:
      kind === 'place'
        ? 'Coordinates extracted from the shared link. Select to drop a pin; the business identity is not verified.'
        : 'Only a map centre or fallback coordinate is available—not a verified place location. Select it only if this is the point you intended.',
  };
}

/** Follow only short-link redirects. Never scrape Google pages, run scripts or forward cookies. */
export async function resolveGoogleMapsLink(
  input: string,
  fetcher: Fetcher,
): Promise<MapLinkResponse> {
  let url = allowedMapUrl(input.trim());
  const seen = new Set<string>();
  const signal = AbortSignal.timeout(8000);
  for (let hop = 0; hop < 6; hop++) {
    if (googleHosts.has(url.hostname)) return coordinatesFromMapUrl(url);
    if (!shortHosts.has(url.hostname) || seen.has(url.href))
      return empty('The map link has a redirect loop. Paste coordinates instead.');
    seen.add(url.href);
    const response = await fetcher(url.href, {
      redirect: 'manual',
      signal,
      headers: { Accept: 'text/html' },
    });
    // Cancel the response stream: only Location is needed, never the page body.
    await response.body?.cancel();
    if (![301, 302, 303, 307, 308].includes(response.status))
      return empty(
        'This short link could not be expanded without opening a Google page. Copy the full Maps URL or coordinates instead.',
      );
    const target = response.headers.get('location');
    if (!target) return empty(fallback);
    url = allowedMapUrl(new URL(target, url).href);
  }
  return empty('The map link has too many redirects. Paste coordinates instead.');
}
