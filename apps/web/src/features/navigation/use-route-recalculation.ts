import { useEffect, useRef, useState } from 'react';
import { walkingRouteSchema, type WalkingRoute } from '@hk/contracts';
import type { LocationFix } from '../../scene/UserLocation';
import { canGuideFrom } from '../../shared/location-quality';

export function useRouteRecalculation(
  active: boolean,
  route: WalkingRoute | null,
  onRoute: (route: WalkingRoute) => void,
) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    setBusy(false);
    return () => pending.current?.abort();
  }, [active]);
  async function recalculate(fix: LocationFix | null) {
    if (!active || !route || !fix) return;
    if (!canGuideFrom(fix)) return;
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
  }
  return { recalculate, busy, error };
}
