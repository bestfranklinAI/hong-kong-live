import { Dialog } from '@base-ui/react/dialog';
import { LocateFixed, List, Navigation, RefreshCw, X } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { WalkingRoute } from '@hk/contracts';
import type { LocationFix } from '../../scene/UserLocation';
import type { routeProgress } from './route-progress';

/** The current instruction stays on the map; supporting details open in a separate sheet. */
export function WalkingGuidance({
  route,
  progress,
  error,
  following,
  onFollow,
  onStop,
  onRecalculate,
  recalculating,
  journeyGuidance,
  fix,
  onRefreshLocation,
}: {
  journeyGuidance?: ReactNode;
  onRecalculate: () => void;
  recalculating: boolean;
  route: WalkingRoute;
  progress: ReturnType<typeof routeProgress>;
  error: string;
  following: boolean;
  onFollow: () => void;
  onStop: () => void;
  fix: LocationFix | null;
  onRefreshLocation: () => void;
}) {
  const host = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    const root = element?.closest<HTMLElement>('.atlas-app');
    if (!element || !root) return;
    const measure = () => {
      root.style.setProperty('--guidance-height', `${element.getBoundingClientRect().height}px`);
      window.dispatchEvent(new Event('hk-sheet-settled'));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      root.style.removeProperty('--guidance-height');
    };
  }, []);
  const step = progress && !progress.offRoute ? route.steps[progress.stepIndex] : null;
  return (
    <aside
      ref={host}
      className="navigation-dock"
      id="discovery"
      aria-label="Active walking navigation"
    >
      <div className="guidance-destination">
        <span>
          <small>Walking to</small>
          <strong>{route.request.end.name}</strong>
        </span>
        <button className="icon-button" aria-label="End walking navigation" onClick={onStop}>
          <X size={20} />
        </button>
      </div>
      {error && (
        <p role="status" className="guidance-alert">
          {error}
        </p>
      )}
      {progress?.offRoute && (
        <div className="guidance-off-route" role="status">
          <strong>You appear away from the route</strong>
          <button className="walking-submit" disabled={recalculating} onClick={onRecalculate}>
            {recalculating ? 'Updating route…' : 'Update route from here'}
          </button>
        </div>
      )}
      {journeyGuidance || (
        <div className="guidance-instruction">
          <Navigation size={28} />
          <strong>
            {progress?.arrived
              ? 'Near your destination'
              : step?.text || 'Follow the highlighted route'}
          </strong>
        </div>
      )}
      <div className="guidance-footer">
        <span>
          <strong>{progress ? `${Math.round(progress.remainingM)} m` : '—'}</strong>
          <small>estimated remaining</small>
        </span>
        <button
          className="guidance-recentre"
          onClick={() => {
            if (!progress) onRefreshLocation();
            onFollow();
          }}
          aria-pressed={following && !!progress}
        >
          <LocateFixed size={18} /> {!progress ? 'Locate' : following ? 'Following' : 'Recentre'}
        </button>
        <Dialog.Root>
          <Dialog.Trigger className="icon-button secondary-button" aria-label="Journey details">
            <List size={20} />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="dialog-backdrop" />
            <Dialog.Popup className="about-dialog guidance-details">
              <div className="dialog-top">
                <Dialog.Title>Journey details</Dialog.Title>
                <Dialog.Close className="icon-button" aria-label="Close journey details">
                  <X size={20} />
                </Dialog.Close>
              </div>
              <Dialog.Description>
                {route.request.end.name} · {Math.round(route.distanceM)} m · about{' '}
                {Math.max(1, Math.round(route.durationMinutes))} min
              </Dialog.Description>
              <details open>
                <summary>Location & accuracy</summary>
                <p>
                  {fix
                    ? `Reported accuracy: approximately ${Math.round(fix.accuracy)} m.`
                    : 'Waiting for a fresh location.'}{' '}
                  Location updates automatically while walking.
                </p>
                <p>
                  GPS can drift between tall buildings and indoors. Enable precise location in your
                  phone settings and try an open area. Floors need manual confirmation.
                </p>
                <button className="secondary-button" onClick={onRefreshLocation}>
                  <RefreshCw size={16} /> Refresh location
                </button>
              </details>
              <details>
                <summary>All directions · {route.steps.length} steps</summary>
                <ol>
                  {route.steps.map((item, index) => (
                    <li key={index}>{item.text}</li>
                  ))}
                </ol>
              </details>
              <details>
                <summary>Route source & limits</summary>
                <p>
                  Directions advance when you tap Continue. GPS estimates your outdoor progress; it
                  cannot confirm a floor or an entrance.
                </p>
                <p>
                  Unrouted connections: {Math.round(route.endpointOffsetsM[0])} m at start ·{' '}
                  {Math.round(route.endpointOffsetsM[1])} m at destination.
                </p>
                {route.warnings.map((warning, index) => (
                  <p key={index}>{warning}</p>
                ))}
                <p>
                  Fetched {new Date(route.fetchedAt).toLocaleString()} · source update time
                  unavailable.
                </p>
                <a className="text-button" href={route.sourceUrl} target="_blank" rel="noreferrer">
                  Lands Department route source ↗
                </a>
              </details>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </aside>
  );
}
