import type { IndoorPoint, StationRouteContext, WalkingRoute } from '@hk/contracts';
/** Exit at the end of a station section, not a straight-line nearest-exit guess. */
export function routeExit(
  route: WalkingRoute,
  context: StationRouteContext,
  points: IndoorPoint[],
) {
  const last = [...context.segments].reverse().find((segment) => segment.levelId);
  if (!last?.levelId || !context.endpointRoles.includes('start')) return undefined;
  const positions = context.segments
    .filter((segment) => segment.levelId === last.levelId)
    .flatMap((segment) =>
      route.paths[segment.pathIndex].slice(segment.segmentIndex, segment.segmentIndex + 2),
    );
  return points
    .filter((point) => point.category === 'entry' && point.levelId === last.levelId)
    .map((point) => ({
      point,
      distance: Math.min(
        ...positions
          .filter((p) => p[2] !== null && Math.abs(point.z - p[2]) < 0.75)
          .map(
            (p) =>
              Math.hypot((point.lng - p[0]) * Math.cos((p[1] * Math.PI) / 180), point.lat - p[1]) *
              111195,
          ),
      ),
    }))
    .filter((row) => row.distance < 12)
    .sort((a, b) => a.distance - b.distance)[0]?.point;
}
