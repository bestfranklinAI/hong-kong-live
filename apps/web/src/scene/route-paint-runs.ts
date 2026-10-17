import type { WalkingRoute, StationRouteView } from '@hk/contracts';
/** Preserve every source edge; only its visual emphasis changes for a station overview. */
export function routePaintRuns(
  route: WalkingRoute,
  sourceHeights: boolean,
  view?: StationRouteView,
) {
  const stationEdges = new Set(
    view?.segments.map((segment) => `${segment.pathIndex}:${segment.segmentIndex}`),
  );
  const runs: Array<{ path: number[][]; station: boolean }> = [];
  for (const [pathIndex, path] of route.paths.entries()) {
    let current: (typeof runs)[number] | undefined;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      if (sourceHeights && (a[2] === null || b[2] === null)) {
        current = undefined;
        continue;
      }
      const station = stationEdges.has(`${pathIndex}:${i - 1}`);
      const convert = (point: typeof a) => [point[0], point[1], sourceHeights ? point[2]! : 3];
      if (current?.station === station) current.path.push(convert(b));
      else {
        current = { station, path: [convert(a), convert(b)] };
        runs.push(current);
      }
    }
  }
  return runs;
}
