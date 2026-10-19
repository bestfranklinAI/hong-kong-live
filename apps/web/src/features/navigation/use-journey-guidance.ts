import { useMemo, useState } from 'react';
import type { StationRouteContext, WalkingRoute } from '@hk/contracts';
import { journeySteps, sameJourneyFloor, type JourneyMapTarget } from './journey-steps';

interface JourneyPosition {
  route: WalkingRoute | null;
  index: number;
  confirmed: JourneyMapTarget | null;
  complete: boolean;
}

export function useJourneyGuidance(
  route: WalkingRoute | null,
  contexts: StationRouteContext[],
  loading = false,
) {
  const steps = useMemo(() => (route ? journeySteps(route, contexts) : []), [route, contexts]);
  const [position, setPosition] = useState<JourneyPosition>({
    route,
    index: 0,
    confirmed: null,
    complete: false,
  });
  // A replacement route starts a new journey, even before its indoor queries finish.
  const current =
    position.route === route ? position : { route, index: 0, confirmed: null, complete: false };
  const step = steps[current.index];
  const confirmed = sameJourneyFloor(step?.map ?? null, current.confirmed);
  const canContinue = !!step && !loading && (!step.map?.levelId || confirmed);
  function move(delta: -1 | 1) {
    if (!step || (delta === 1 && !canContinue)) return null;
    const index = Math.max(0, Math.min(steps.length - 1, current.index + delta));
    setPosition({
      route,
      index,
      confirmed: sameJourneyFloor(step.map, steps[index].map) ? current.confirmed : null,
      complete: delta === 1 && index === current.index,
    });
    return steps[index];
  }
  return {
    steps,
    index: current.index,
    step,
    confirmed,
    complete: current.complete,
    canContinue,
    loading,
    move,
    confirm: (venueId: string, levelId: string) => {
      if (step?.map?.venueId !== venueId || step.map.levelId !== levelId) return;
      setPosition({ ...current, confirmed: step.map });
    },
  };
}
