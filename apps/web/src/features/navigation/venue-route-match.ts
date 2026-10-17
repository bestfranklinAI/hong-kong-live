import type {
  IndoorFloor,
  StationRouteContext,
  StationRouteSegment,
  WalkingRoute,
} from '@hk/contracts';
import {
  classifyStationRoute,
  floorContains,
  floorContainsSegment,
} from './station-route-geometry';

const compact = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
function namedLevel(text: string, venue: string, floor: IndoorFloor) {
  const name = compact(venue),
    instruction = compact(text);
  if (!name || !instruction.includes(name)) return false;
  const aliases = /^(ground floor|ground level|gf|g)$/i.test(floor.name)
    ? ['levelg', 'groundfloor', 'groundlevel']
    : [compact(floor.name)];
  return aliases.some((alias) => instruction.includes(name + alias));
}
/** Direction-distance intervals support a 2D floor view, never a vertical datum conversion. */
export function classifyVenueRoute(
  route: WalkingRoute,
  floors: IndoorFloor[],
  venue: StationRouteContext['venue'],
) {
  const geometric = classifyStationRoute(route, floors, venue.id);
  if (venue.kind !== 'building') return geometric;
  const edges = route.paths.flatMap((path, pathIndex) =>
    path.slice(1).map((b, index) => {
      const a = path[index];
      const horizontal =
        Math.hypot((b[0] - a[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360), b[1] - a[1]) * 111195;
      return {
        a,
        b,
        pathIndex,
        segmentIndex: index,
        length: Math.hypot(horizontal, a[2] !== null && b[2] !== null ? b[2] - a[2] : 0),
      };
    }),
  );
  const total = edges.reduce((sum, edge) => sum + edge.length, 0);
  const directionsTotal = route.steps.reduce((sum, step) => sum + step.distanceM, 0);
  // Refuse distance mapping when the two source representations disagree materially.
  if (!total || Math.abs(total - directionsTotal) > Math.max(2, total * 0.01)) return geometric;
  let at = 0;
  const intervals = route.steps.map((step) => {
    const start = at;
    at += step.distanceM;
    return { start, end: at, text: step.text };
  });
  let travelled = 0;
  const result = new Map(
    geometric.map((segment) => [`${segment.pathIndex}:${segment.segmentIndex}`, segment]),
  );
  for (const edge of edges) {
    const start = (travelled / total) * directionsTotal;
    travelled += edge.length;
    const end = (travelled / total) * directionsTotal;
    const key = `${edge.pathIndex}:${edge.segmentIndex}`;
    if (result.get(key)?.levelId) continue;
    // Keep complete edges inside one explicitly named instruction; do not borrow a neighbouring floor.
    const instruction = intervals.find(
      (step) => start >= step.start - 0.5 && end <= step.end + 0.5 && step.end > step.start,
    );
    if (!instruction) continue;
    const instructionIndex = intervals.indexOf(instruction);
    const bridgedGroundLabel = (floor: IndoorFloor) =>
      /^(ground floor|ground level|gf|g)$/i.test(floor.name) &&
      /\bon (?:level\s+)?g\s*$/i.test(instruction.text) &&
      namedLevel(intervals[instructionIndex - 1]?.text ?? '', venue.name, floor) &&
      namedLevel(intervals[instructionIndex + 1]?.text ?? '', venue.name, floor);
    const hits = floors.filter(
      (floor) =>
        (namedLevel(instruction.text, venue.name, floor) || bridgedGroundLabel(floor)) &&
        (floorContainsSegment(floor, [edge.a[0], edge.a[1]], [edge.b[0], edge.b[1]]) ||
          floorContains(floor, [edge.a[0], edge.a[1]]) ||
          floorContains(floor, [edge.b[0], edge.b[1]])),
    );
    if (hits.length !== 1) continue;
    const segment: StationRouteSegment = {
      pathIndex: edge.pathIndex,
      segmentIndex: edge.segmentIndex,
      venueId: venue.id,
      levelId: hits[0].id,
      kind: 'floor',
      match: 'direction-level',
    };
    result.set(key, segment);
  }
  return [...result.values()].sort(
    (a, b) => a.pathIndex - b.pathIndex || a.segmentIndex - b.segmentIndex,
  );
}
