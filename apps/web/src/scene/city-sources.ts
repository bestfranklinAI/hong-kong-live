import type { CitySources } from './CityLayers';

/** Derive only the documented buildings API; custom/self-hosted sources need explicit URLs. */
export function resolveCitySources(photo?: string, buildings?: string): CitySources {
  const sources: CitySources = { photo: photo || undefined, buildings: buildings || undefined };
  if (!photo) return sources;
  try {
    const url = new URL(photo);
    if (url.origin !== 'https://data.map.gov.hk') return sources;
    if (
      [
        '/api/3d-data/3dtiles/t_bi_f1/tileset.json',
        '/api/3d-data/3dsd/WGS84/building/tileset.json',
      ].includes(url.pathname)
    )
      return { buildings: buildings || photo };
    if (url.pathname === '/api/3d-data/3dtiles/f2/tileset.json' && !buildings) {
      url.pathname = '/api/3d-data/3dsd/WGS84/building/tileset.json';
      sources.buildings = url.toString();
    }
  } catch {
    /* The renderer reports invalid source configuration. */
  }
  return sources;
}

/** LandsD reflects Origin without Vary; separate cached CORS responses by app origin. */
export function scopeCitySource(source: string, appOrigin: string): string {
  const url = new URL(source, appOrigin);
  if (url.origin !== 'https://data.map.gov.hk' || !url.pathname.startsWith('/api/3d-data/'))
    return url.toString();
  let hash = 14695981039346656037n;
  for (const character of appOrigin)
    hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 1099511628211n);
  // Stable across reloads; do not put private hostnames or location data in the query.
  url.searchParams.set('_hk_origin', hash.toString(16));
  return url.toString();
}

export const configuredCitySources = resolveCitySources(
  import.meta.env.VITE_HK_3D_TILESET_URL,
  import.meta.env.VITE_HK_3D_BUILDINGS_TILESET_URL,
);
export const hasCitySource = Boolean(
  configuredCitySources.photo || configuredCitySources.buildings,
);
