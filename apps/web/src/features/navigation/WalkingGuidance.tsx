import { LocateFixed, Navigation, X } from 'lucide-react';
import type { WalkingRoute } from '@hk/contracts';
import type { routeProgress } from './route-progress';
import type { ReactNode } from 'react';
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
}) {
  const step = progress && !progress.offRoute ? route.steps[progress.stepIndex] : null;
  return (
    <section className="walking-guidance" aria-label="Active walking navigation">
      {journeyGuidance}
      {journeyGuidance && error && (
        <p role="status" className="journey-note">
          {error}
        </p>
      )}
      {!journeyGuidance && (
        <div className="guidance-instruction">
          <Navigation size={30} />
          <div>
            <small>{progress?.arrived ? 'Near your destination' : 'Walking guidance'}</small>
            <strong>
              {error ||
                (progress?.offRoute
                  ? 'You appear away from the route'
                  : step?.text || 'Follow the highlighted route')}
            </strong>
          </div>
        </div>
      )}
      <div className="guidance-trip">
        <span>
          <strong>{progress ? `${Math.round(progress.remainingM)} m` : '—'}</strong>
          <small>{progress ? 'remaining · estimated' : 'Waiting for location'}</small>
        </span>
        <button className="guidance-recentre" onClick={onFollow}>
          <LocateFixed size={18} />
          {following ? 'Following' : 'Recentre'}
        </button>
        <button className="icon-button" aria-label="End walking navigation" onClick={onStop}>
          <X size={20} />
        </button>
      </div>
      {progress?.offRoute && (
        <p className="journey-note">
          GPS is approximate, especially indoors. Check your position before updating the route.
        </p>
      )}
      {progress?.offRoute && (
        <button className="walking-submit" disabled={recalculating} onClick={onRecalculate}>
          {recalculating ? 'Updating route…' : 'Update route from here'}
        </button>
      )}
      <details>
        <summary>Trip details</summary>
        <p>{route.request.end.name}</p>
        <p>
          GPS guidance is approximate. It cannot identify indoor floors; follow station signs and
          the source directions.
        </p>
        <ol>
          {route.steps.map((s, i) => (
            <li key={i}>{s.text}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
