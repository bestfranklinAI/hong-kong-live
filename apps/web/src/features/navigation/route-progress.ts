import type { WalkingRoute } from '@hk/contracts';
import type { LocationFix } from '../../scene/UserLocation';
const METRES = 111195;

/** XY progress is an estimate, never proof of the user's indoor floor. Gaps are not joined. */
export function routeProgress(route: WalkingRoute, fix: LocationFix, previousM?: number) {
  const cos = Math.cos((fix.lat * Math.PI) / 180);
  let along = 0;
  const candidates: { distance: number; along: number; z: number | null }[] = [];
  for (const path of route.paths)
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      const ax = (a[0] - fix.lng) * METRES * cos,
        ay = (a[1] - fix.lat) * METRES;
      const dx = (b[0] - a[0]) * METRES * cos,
        dy = (b[1] - a[1]) * METRES;
      const length = Math.hypot(dx, dy);
      const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (length * length))) : 0;
      candidates.push({
        distance: Math.hypot(ax + dx * t, ay + dy * t),
        along: along + length * t,
        z: a[2] !== null && b[2] !== null ? a[2] + (b[2] - a[2]) * t : null,
      });
      along += length;
    }
  candidates.sort((a, b) => a.distance - b.distance);
  const nearest = candidates[0];
  if (!nearest) return null;
  // At crossing paths, avoid jumping ahead to a later loop with a nearly identical XY.
  const match =
    previousM === undefined
      ? nearest
      : candidates
          .filter((p) => p.distance <= nearest.distance + 3)
          .sort((a, b) => Math.abs(a.along - previousM) - Math.abs(b.along - previousM))[0];
  const fraction = along ? match.along / along : 0;
  const remainingM = Math.max(0, route.distanceM * (1 - fraction));
  const totalSteps = route.steps.reduce((sum, step) => sum + step.distanceM, 0);
  let offset = 0;
  let stepIndex = route.steps.findIndex((step) => {
    offset += step.distanceM;
    return offset > fraction * totalSteps;
  });
  if (stepIndex < 0) stepIndex = route.steps.length - 1;
  return {
    alongM: match.along,
    remainingM,
    stepIndex,
    distanceM: match.distance,
    z: match.z,
    offRoute: match.distance > Math.max(25, Math.min(60, fix.accuracy * 1.5)),
    arrived: remainingM < 15 && match.distance < 20 && fix.accuracy <= 30,
  };
}
