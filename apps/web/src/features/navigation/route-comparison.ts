import type { RouteRequest, WalkingRoute } from '@hk/contracts';
import { instructionTransition, transitionLabels } from './navigation-symbols';

export type WalkingProfile = RouteRequest['profile'];
export const walkingProfiles = [
  { id: 'recommended', label: 'Recommended', description: 'Government Recommended Path' },
  { id: 'shortest', label: 'Shortest', description: 'Government Shortest Path' },
  { id: 'barrier-free', label: 'Barrier-free', description: 'Government Barrier Free Path' },
] as const;

/** Instruction mentions are not equipment counts or a complete accessibility audit. */
export function connectionMentions(route: WalkingRoute) {
  return Object.entries(transitionLabels)
    .map(([kind, label]) => ({
      kind,
      label,
      count: route.steps.filter((step) => instructionTransition(step.text) === kind).length,
    }))
    .filter((row) => row.count > 0);
}

export function sameRouteEndpoints(a: WalkingRoute, b: WalkingRoute) {
  return (['start', 'end'] as const).every((role) => {
    const x = a.request[role],
      y = b.request[role];
    return (
      x.lat === y.lat &&
      x.lng === y.lng &&
      x.z === y.z &&
      x.indoor?.venueId === y.indoor?.venueId &&
      x.indoor?.pointId === y.indoor?.pointId
    );
  });
}

export function routeDifference(route: WalkingRoute, recommended?: WalkingRoute) {
  if (!recommended || route.request.profile === 'recommended') return null;
  if (!sameRouteEndpoints(route, recommended))
    return 'Mapped endpoints differ from Recommended; check the connections below.';
  if (JSON.stringify(route.paths) === JSON.stringify(recommended.paths))
    return 'Same mapped path as Recommended';
  const distance = route.distanceM - recommended.distanceM;
  const time = route.durationMinutes - recommended.durationMinutes;
  const metres = Math.round(Math.abs(distance));
  const minutes = Math.round(Math.abs(time));
  return `${metres === 0 ? 'Similar distance' : `${metres} m ${distance < 0 ? 'shorter' : 'longer'}`} · ${minutes === 0 ? 'similar estimated time' : `about ${minutes} min ${time < 0 ? 'quicker' : 'slower'}`} vs Recommended`;
}
