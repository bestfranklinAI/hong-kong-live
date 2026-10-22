import { useCallback, useEffect, useRef, useState } from 'react';
import { walkingRouteSchema, type WalkingRoute } from '@hk/contracts';
import type { LocationFix } from '../../scene/UserLocation';
import { canGuideFrom } from '../../shared/location-quality';

export function useRouteRecalculation(
  active: boolean,
  route: WalkingRoute | null,
  onRoute: (route: WalkingRoute) => void,
  fix: LocationFix | null = null,
  offRoute = false,
) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deviation = useRef({
    since: 0,
    samples: 0,
    lastAttempt: -Infinity,
    lastFix: null as LocationFix | null,
  });
  useEffect(() => {
    setError('');
    setBusy(false);
    deviation.current.since = 0;
    deviation.current.samples = 0;
    deviation.current.lastFix = null;
    return () => pending.current?.abort();
  }, [active, route]);
  const recalculate = useCallback(
    async (fix: LocationFix | null) => {
      if (!active || !route || !fix) return;
      if (!canGuideFrom(fix)) return;
      deviation.current.lastAttempt = Date.now();
      pending.current?.abort();
      const request = new AbortController();
      const timeout = AbortSignal.timeout(20000);
      const signal = AbortSignal.any([request.signal, timeout]);
      pending.current = request;
      setBusy(true);
      setError('');
      try {
        const response = await fetch('/api/v1/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            ...route.request,
            start: { lat: fix.lat, lng: fix.lng, name: 'Current location' },
          }),
        });
        const data = await response.json().catch(() => {
          throw new Error('Route update unavailable. Try again.');
        });
        if (!response.ok)
          throw new Error(typeof data?.error === 'string' ? data.error : 'Could not update route.');
        const parsed = walkingRouteSchema.safeParse(data);
        if (!parsed.success) throw new Error('Route update unavailable. Try again.');
        signal.throwIfAborted();
        onRoute(parsed.data);
      } catch (err) {
        if (!request.signal.aborted)
          setError(
            timeout.aborted
              ? 'Route update timed out. Try again.'
              : err instanceof Error
                ? err.message
                : 'Could not update route.',
          );
      } finally {
        if (!request.signal.aborted) setBusy(false);
      }
    },
    [active, route, onRoute],
  );
  useEffect(() => {
    const state = deviation.current;
    if (!active || !offRoute || !fix || !canGuideFrom(fix) || fix.accuracy > 25) {
      state.since = 0;
      state.samples = 0;
      return;
    }
    if (fix === state.lastFix) return;
    state.lastFix = fix;
    const now = Date.now();
    if (!state.samples) state.since = now;
    state.samples++;
    // Sustained accurate fixes avoid rerouting for one drifting reading in a street canyon.
    if (
      state.samples >= 3 &&
      now - state.since >= 8000 &&
      now - state.lastAttempt >= 30000 &&
      !busy
    ) {
      state.lastAttempt = now;
      void recalculate(fix);
    }
  }, [active, offRoute, fix, busy, recalculate]);
  return { recalculate, busy, error };
}
