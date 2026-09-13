import { mtrLines } from '@hk/contracts';
import data from './railway-tracks.json';

export interface RailSegment {
  id: string;
  from: string;
  to: string;
  coordinates: number[][];
  distances: number[];
}
export function measureTrack(coordinates: number[][]): number[] {
  const distances = coordinates.map(() => 0);
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1],
      b = coordinates[i];
    distances[i] =
      distances[i - 1] +
      Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 111195;
  }
  return distances;
}
export const railwayRoutes: Record<
  string,
  { stations: Record<string, number>; coordinates: number[][] }[]
> = data.lines as unknown as Record<
  string,
  { stations: Record<string, number>; coordinates: number[][] }[]
>;
export const railSegments: Record<string, RailSegment[]> = Object.fromEntries(
  Object.entries(railwayRoutes).map(([line, routes]) => {
    const segments = new Map<string, RailSegment>();
    for (const route of routes) {
      const stops = Object.entries(route.stations);
      for (let i = 1; i < stops.length; i++) {
        const [from, start] = stops[i - 1],
          [to, end] = stops[i];
        const id = line + ':' + from + ':' + to;
        if (segments.has(id)) continue;
        const coordinates = route.coordinates.slice(start, end + 1);
        segments.set(id, { id, from, to, coordinates, distances: measureTrack(coordinates) });
      }
    }
    return [line, [...segments.values()]];
  }),
);

/** Branch topology comes from route members, never the flat station picker order. */
export function incomingSegment(
  line: string,
  station: string,
  destination: string,
  viaRacecourse: boolean,
) {
  const catalogue = mtrLines.find((item) => item.code === line)?.stations ?? [];
  const step = Math.sign(catalogue.indexOf(destination) - catalogue.indexOf(station));
  if (!step || !catalogue.includes(destination)) return;
  const edges = (railSegments[line] ?? []).filter(
    (edge) =>
      line !== 'EAL' ||
      (viaRacecourse
        ? edge.from !== 'FOT' && edge.to !== 'FOT'
        : edge.from !== 'RAC' && edge.to !== 'RAC'),
  );
  const start = (edge: RailSegment) => (step > 0 ? edge.from : edge.to);
  const end = (edge: RailSegment) => (step > 0 ? edge.to : edge.from);
  const visited = new Set<string>();
  const reaches = (current: string): boolean => {
    if (current === destination) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    return edges.some((edge) => start(edge) === current && reaches(end(edge)));
  };
  if (!reaches(station)) return;
  const candidates = edges.filter((edge) => end(edge) === station);
  // An ETA destination cannot identify the incoming branch at a merge.
  if (candidates.length > 1) return;
  if (candidates.length === 1) return { segment: candidates[0], step, departure: false };
  const outgoing = edges.filter((edge) => start(edge) === station);
  if (outgoing.length !== 1) return;
  return { segment: outgoing[0], step, departure: true };
}
