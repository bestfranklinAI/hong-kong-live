import type { LocationFix } from '../../scene/UserLocation';

/** One cancellable GPS subscription. Expired fixes never keep the camera moving. */
export function watchWalkingLocation(
  geolocation: Geolocation,
  onFix: (fix: LocationFix | null) => void,
  onError: (message: string) => void,
  now = Date.now,
) {
  let live = true,
    lastAt: number | undefined,
    newestAt: number | undefined,
    watch: number;
  try {
    watch = geolocation.watchPosition(
      ({ coords, timestamp }) => {
        if (
          !live ||
          !Number.isFinite(coords.latitude) ||
          !Number.isFinite(coords.longitude) ||
          Math.abs(coords.latitude) > 90 ||
          Math.abs(coords.longitude) > 180 ||
          !Number.isFinite(coords.accuracy) ||
          coords.accuracy < 0 ||
          !Number.isFinite(timestamp) ||
          now() - timestamp > 30000 ||
          timestamp - now() > 2000 ||
          (newestAt !== undefined && timestamp < newestAt)
        )
          return;
        lastAt = timestamp;
        newestAt = timestamp;
        onError('');
        onFix({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          timestamp,
          heading:
            coords.heading !== null && Number.isFinite(coords.heading) && (coords.speed ?? 0) > 0.5
              ? coords.heading
              : undefined,
        });
      },
      (error) => {
        if (live) {
          // A denied permission invalidates the old position immediately, not at expiry.
          if (error.code === 1) {
            lastAt = undefined;
            onFix(null);
          }
          onError(
            error.code === 1
              ? 'Location permission denied. Enable it to follow your walk.'
              : 'Waiting for a GPS signal…',
          );
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    );
  } catch {
    onError('Location unavailable. Check browser permission.');
    return () => {
      live = false;
    };
  }
  const timer = setInterval(() => {
    if (live && lastAt !== undefined && now() - lastAt > 30000) {
      lastAt = undefined;
      onFix(null);
      onError('GPS signal lost. Waiting to reconnect…');
    }
  }, 5000);
  return () => {
    live = false;
    geolocation.clearWatch(watch);
    clearInterval(timer);
  };
}
