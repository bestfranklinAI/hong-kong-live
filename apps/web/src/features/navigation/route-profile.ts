import type { WalkingRoute } from '@hk/contracts';
export interface ProfilePoint {
  distanceM: number;
  height: number | null;
  lng: number;
  lat: number;
  breakBefore: boolean;
}
/** Horizontal chainage excludes gaps between disjoint paths; vertical edges retain equal X. */
export function routeProfile(paths: WalkingRoute['paths']): ProfilePoint[] {
  let distanceM = 0;
  const points: ProfilePoint[] = [];
  for (const path of paths) {
    let previous: (typeof path)[number] | undefined;
    for (const [lng, lat, height] of path) {
      if (previous) {
        const r = Math.PI / 180;
        const a =
          Math.sin(((lat - previous[1]) * r) / 2) ** 2 +
          Math.cos(lat * r) *
            Math.cos(previous[1] * r) *
            Math.sin(((lng - previous[0]) * r) / 2) ** 2;
        distanceM += 12742000 * Math.asin(Math.min(1, Math.sqrt(a)));
      }
      points.push({ distanceM, height, lng, lat, breakBefore: !previous });
      previous = [lng, lat, height];
    }
  }
  return points;
}
export function profileDrawing(points: ProfilePoint[]) {
  const heights = points.flatMap((p) => (p.height === null ? [] : [p.height]));
  if (!heights.length) return null;
  const min = Math.min(...heights),
    max = Math.max(...heights);
  const distance = points.at(-1)?.distanceM ?? 0;
  const x = (value: number) => 28 + (distance ? value / distance : 0) * 344;
  const y = (value: number) => (max === min ? 75 : 126 - ((value - min) / (max - min)) * 102);
  let connected = false;
  const commands: string[] = [];
  for (const point of points) {
    if (point.height === null) {
      connected = false;
      continue;
    }
    commands.push(
      `${!connected || point.breakBefore ? 'M' : 'L'}${x(point.distanceM).toFixed(2)},${y(point.height).toFixed(2)}`,
    );
    connected = true;
  }
  return { min, max, distance, path: commands.join(' '), x, y };
}
