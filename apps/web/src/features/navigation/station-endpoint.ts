import { mtrStations, mtrLines, mtrStationLocations, type RouteEndpoint } from '@hk/contracts';
export const stationNameKey = (name: string) =>
  name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\bmtr\b|\bstation\b|港鐵|鐵路站|站|\s+/g, '');
/** Exact bilingual reference-name matching only; never assume the nearest station or indoor floor. */
export function endpointStation(endpoint?: RouteEndpoint) {
  if (!endpoint || endpoint.indoor) return null;
  const code =
    endpoint.station?.station ??
    Object.keys(mtrStations).find((code) =>
      [mtrStations[code].name, mtrStations[code].nameZh].some(
        (name) => stationNameKey(name) === stationNameKey(endpoint.name),
      ),
    );
  if (!code || !mtrStations[code]) return null;
  const reference = mtrStationLocations[code];
  if (
    !endpoint.station &&
    reference &&
    Math.hypot(
      (endpoint.lng - reference.lng) * Math.cos((endpoint.lat * Math.PI) / 180),
      endpoint.lat - reference.lat,
    ) *
      111195 >
      500
  )
    return null;
  return {
    ...mtrStations[code],
    code,
    line: mtrLines.find((line) => line.stations.includes(code))!.code,
  };
}

/** Match an explicit named station after a source instruction's location preposition. */
export function directionNamesStation(text: string, venue: { name: string; nameZh: string }) {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`(?:\\bon\\s+|\\bat\\s+)(?:MTR\\s+)?${escape(venue.name)}\\b`, 'i').test(text))
    return true;
  return [venue.nameZh, venue.nameZh.replace(/鐵路站$/, '站')]
    .filter(Boolean)
    .some((name) => new RegExp(`(?:沿|在|進入|到達|往)\\s*${escape(name)}`).test(text));
}
