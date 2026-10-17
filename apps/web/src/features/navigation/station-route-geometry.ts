import type { IndoorFloor, StationRouteSegment, WalkingRoute } from '@hk/contracts';
type Point = readonly number[];
const EPS = 1e-10;
const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
/** Boundary is distinct so holes exclude their interiors, while shared boundary walks stay visible. */
function ringLocation(point: Point, ring: number[][]): 'inside' | 'outside' | 'boundary' {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1],
      b = ring[i];
    const area = cross(b[0] - a[0], b[1] - a[1], point[0] - a[0], point[1] - a[1]);
    if (
      Math.abs(area) < 1e-14 &&
      point[0] >= Math.min(a[0], b[0]) - EPS &&
      point[0] <= Math.max(a[0], b[0]) + EPS &&
      point[1] >= Math.min(a[1], b[1]) - EPS &&
      point[1] <= Math.max(a[1], b[1]) + EPS
    )
      return 'boundary';
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}
export function floorContains(floor: IndoorFloor, point: Point) {
  return floor.polygons.some(
    (polygon) =>
      ringLocation(point, polygon[0]) !== 'outside' &&
      !polygon.slice(1).some((hole) => ringLocation(point, hole) === 'inside'),
  );
}
/** Split at every ring intersection: endpoint/midpoint-only checks can miss holes or concave gaps. */
export function floorContainsSegment(floor: IndoorFloor, a: Point, b: Point) {
  if (!floorContains(floor, a) || !floorContains(floor, b)) return false;
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const cuts = [0, 1];
  for (const polygon of floor.polygons)
    for (const ring of polygon)
      for (let i = 1; i < ring.length; i++) {
        const c = ring[i - 1],
          d = ring[i],
          ex = d[0] - c[0],
          ey = d[1] - c[1];
        const det = cross(dx, dy, ex, ey);
        if (Math.abs(det) < 1e-20) continue;
        const t = cross(c[0] - a[0], c[1] - a[1], ex, ey) / det;
        const u = cross(c[0] - a[0], c[1] - a[1], dx, dy) / det;
        if (t > 0 && t < 1 && u >= -EPS && u <= 1 + EPS) cuts.push(t);
      }
  cuts.sort((a, b) => a - b);
  return cuts.every(
    (t, i) =>
      i === 0 ||
      floorContains(floor, [
        a[0] + (dx * (t + cuts[i - 1])) / 2,
        a[1] + (dy * (t + cuts[i - 1])) / 2,
      ]),
  );
}
/** Matches source XY+Z only. Unknown/ambiguous segments are never silently attached to a named floor. */
export function classifyStationRoute(
  route: WalkingRoute,
  floors: IndoorFloor[],
  venueId: string,
): StationRouteSegment[] {
  const result: StationRouteSegment[] = [];
  floors = floors.filter((floor) => floor.venueId === venueId);
  if (!floors.length) return result;
  const low = Math.min(...floors.map((floor) => floor.z)) - 0.25,
    high = Math.max(...floors.map((floor) => floor.z)) + 0.25;
  const envelope: IndoorFloor = {
    ...floors[0],
    polygons: floors.flatMap((floor) => floor.polygons),
  };

  const prepared = floors.map((floor) => {
    const xy = floor.polygons.flat(2);
    return {
      floor,
      minX: Math.min(...xy.map((p) => p[0])),
      maxX: Math.max(...xy.map((p) => p[0])),
      minY: Math.min(...xy.map((p) => p[1])),
      maxY: Math.max(...xy.map((p) => p[1])),
    };
  });
  const inside = (p: Point) =>
    prepared.filter(
      (f) =>
        p[0] >= f.minX - EPS &&
        p[0] <= f.maxX + EPS &&
        p[1] >= f.minY - EPS &&
        p[1] <= f.maxY + EPS &&
        floorContains(f.floor, p),
    );
  for (const [pathIndex, path] of route.paths.entries())
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      if (a[2] === null || b[2] === null) continue;
      const aFloors = inside(a as number[]),
        bFloors = inside(b as number[]);
      if (!aFloors.length || !bFloors.length) continue;
      const hits = aFloors.filter(
        ({ floor }) =>
          Math.abs(a[2]! - floor.z) <= 0.25 &&
          Math.abs(b[2]! - floor.z) <= 0.25 &&
          floorContainsSegment(floor, a as number[], b as number[]),
      );
      if (a[2] < low || a[2] > high || b[2] < low || b[2] > high) continue;
      if (!hits.length && !floorContainsSegment(envelope, a as number[], b as number[])) continue;
      result.push({
        pathIndex,
        segmentIndex: i - 1,
        venueId,
        levelId: hits.length === 1 ? hits[0].floor.id : null,
        kind:
          hits.length === 1 ? 'floor' : Math.abs(b[2] - a[2]) > 0.5 ? 'level-change' : 'unassigned',
      });
    }
  return result;
}
export function floorRoutePaths(
  route: WalkingRoute,
  segments: StationRouteSegment[],
  levelId: string,
) {
  const runs: number[][][] = [];
  const matched = new Set(
    segments
      .filter((segment) => segment.levelId === levelId)
      .map((segment) => `${segment.pathIndex}:${segment.segmentIndex}`),
  );
  for (const [pathIndex, path] of route.paths.entries()) {
    let run: number[][] = [];
    for (let i = 1; i < path.length; i++) {
      const segment = matched.has(`${pathIndex}:${i - 1}`);
      if (segment) {
        if (!run.length) run.push(path[i - 1] as number[]);
        run.push(path[i] as number[]);
      } else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

export function floorRouteChanges(
  route: WalkingRoute,
  segments: StationRouteSegment[],
  floor: IndoorFloor,
) {
  return segments
    .filter((segment) => segment.kind === 'level-change')
    .flatMap((segment) => {
      const [a, b] = route.paths[segment.pathIndex].slice(
        segment.segmentIndex,
        segment.segmentIndex + 2,
      );
      if (a[2] === null || b[2] === null) return [];
      const point =
        Math.abs(a[2] - floor.z) <= 0.25 ? a : Math.abs(b[2] - floor.z) <= 0.25 ? b : null;
      return point
        ? [
            {
              point: point as number[],
              direction: b[2] > a[2] ? ('up' as const) : ('down' as const),
            },
          ]
        : [];
    });
}
