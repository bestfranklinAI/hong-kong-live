import { useCallback, useEffect, useRef, useState } from 'react';
import type { RouteRequest, WalkingRoute } from '@hk/contracts';
import { walkingProfiles, type WalkingProfile } from './route-comparison';
import { requestWalkingRoute } from './request-walking-route';

export type RouteChoice =
  | { status: 'pending' }
  | { status: 'ready'; route: WalkingRoute }
  | { status: 'error'; error: string };
interface Comparison {
  request: RouteRequest | null;
  choices: Partial<Record<WalkingProfile, RouteChoice>>;
  expanded: boolean;
}
function seed(route?: WalkingRoute): Comparison {
  return {
    // Compare from the same resolved source points, including a resolved concourse connection.
    request: route?.request ?? null,
    choices: route ? { [route.request.profile]: { status: 'ready', route } } : {},
    expanded: false,
  };
}

export function useRouteComparison(initialRoute?: WalkingRoute) {
  const [comparison, setComparison] = useState(() => seed(initialRoute));
  const generation = useRef(0);
  const pending = useRef(new Map<WalkingProfile, AbortController>());
  const cancel = useCallback(() => {
    generation.current++;
    for (const controller of pending.current.values()) controller.abort();
    pending.current.clear();
  }, []);
  useEffect(() => () => cancel(), [cancel]);
  function reset(route?: WalkingRoute) {
    cancel();
    setComparison(seed(route));
  }
  async function load(profile: WalkingProfile) {
    if (
      !comparison.request ||
      pending.current.has(profile) ||
      comparison.choices[profile]?.status === 'ready'
    )
      return;
    const revision = generation.current;
    const controller = new AbortController();
    pending.current.set(profile, controller);
    const update = (choice: RouteChoice) => {
      if (revision !== generation.current || controller.signal.aborted) return;
      setComparison((current) => ({
        ...current,
        choices: { ...current.choices, [profile]: choice },
      }));
    };
    update({ status: 'pending' });
    try {
      const route = await requestWalkingRoute(
        { ...comparison.request, profile },
        controller.signal,
      );
      update({ status: 'ready', route });
    } catch (error) {
      update({
        status: 'error',
        error: error instanceof Error ? error.message : 'Route unavailable. Try again.',
      });
    } finally {
      if (pending.current.get(profile) === controller) pending.current.delete(profile);
    }
  }
  return {
    ...comparison,
    reset,
    retry: load,
    toggle: () => {
      setComparison((current) => ({ ...current, expanded: !current.expanded }));
      if (!comparison.expanded)
        return Promise.allSettled(walkingProfiles.map(({ id }) => load(id)));
    },
  };
}
