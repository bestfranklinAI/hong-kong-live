import { watchWalkingLocation } from './walking-location';
import { useEffect, useRef, useState } from 'react';
import type { WalkingRoute } from '@hk/contracts';
import type { LocationFix } from '../../scene/UserLocation';
import { routeProgress } from './route-progress';
import { canGuideFrom } from '../../shared/location-quality';

export function useWalkingGuidance(route: WalkingRoute | null, active: boolean) {
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ReturnType<typeof routeProgress>>(null);
  const previous = useRef<{ route: WalkingRoute | null; alongM?: number }>({ route: null });
  const hasRoute = route !== null;
  useEffect(() => {
    if (previous.current.route !== route || !active) previous.current = { route };
    if (!active || !route || !fix || !canGuideFrom(fix)) {
      setProgress(null);
      return;
    }
    const next = routeProgress(route, fix, previous.current.alongM);
    if (next && !next.offRoute) previous.current.alongM = next.alongM;
    setProgress(next);
  }, [active, route, fix]);
  useEffect(() => {
    if (!active || !hasRoute) return;
    let live = true;
    setFix(null);
    setProgress(null);
    setError('');
    if (!navigator.geolocation || !window.isSecureContext) {
      setError('Location needs HTTPS and browser permission.');
      return;
    }
    const stopLocation = watchWalkingLocation(navigator.geolocation, setFix, setError);
    let lock: WakeLockSentinel | undefined;
    let wakePending = false;
    const wake = () => {
      if (
        document.visibilityState === 'visible' &&
        navigator.wakeLock &&
        !wakePending &&
        (!lock || lock.released)
      ) {
        wakePending = true;
        void navigator.wakeLock
          .request('screen')
          .then((value) => {
            if (live && document.visibilityState === 'visible') lock = value;
            else void value.release();
          })
          .catch(() => undefined)
          .finally(() => {
            wakePending = false;
          });
      }
    };
    wake();
    document.addEventListener('visibilitychange', wake);
    return () => {
      live = false;
      stopLocation();
      document.removeEventListener('visibilitychange', wake);
      void lock?.release();
    };
    // Route replacement must not restart GPS, heading follow or the screen wake lock.
  }, [active, hasRoute]);
  return {
    fix: active ? fix : null,
    progress: active ? progress : null,
    error: active
      ? error || (fix && !canGuideFrom(fix) ? 'Waiting for a more accurate location…' : '')
      : '',
  };
}
