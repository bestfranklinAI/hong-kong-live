import type { WalkingRoute, StationRouteView } from '@hk/contracts';
/** Preserve every source edge; only its visual emphasis changes for a station overview. */
export function routePaintRuns(
  route: WalkingRoute,
  sourceHeights: boolean,
  view?: StationRouteView,
  completedM = 0,
) {
  const stationEdges = new Set(
    view?.segments.map((segment) => `${segment.pathIndex}:${segment.segmentIndex}`),
  );
  const runs: Array<{ path: number[][]; station: boolean; completed: boolean }> = [];
  let along = 0;
  for (const [pathIndex, path] of route.paths.entries()) {
    let current: (typeof runs)[number] | undefined;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      const length = Math.hypot(
        (b[0] - a[0]) * 111195 * Math.cos(((a[1] + b[1]) * Math.PI) / 360),
        (b[1] - a[1]) * 111195,
      );
      const startM = along;
      along += length;
      if (sourceHeights && (a[2] === null || b[2] === null)) {
        current = undefined;
        continue;
      }
      const station = stationEdges.has(`${pathIndex}:${i - 1}`);
      const convert = (point: typeof a) => [point[0], point[1], sourceHeights ? point[2]! : 3];
      const append = (start: number[], end: number[], completed: boolean) => {
        if (current?.station === station && current.completed === completed) current.path.push(end);
        else {
          current = { station, completed, path: [start, end] };
          runs.push(current);
        }
      };
      if (completedM > startM && completedM < along && length > 0) {
        const t = (completedM - startM) / length;
        const start = convert(a),
          end = convert(b);
        const split = start.map((value, index) => value + (end[index] - value) * t);
        append(start, split, true);
        append(split, end, false);
      } else append(convert(a), convert(b), completedM > 0 && along <= completedM);
    }
  }
  return runs;
}
