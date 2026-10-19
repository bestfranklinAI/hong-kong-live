import { Check, ChevronDown } from 'lucide-react';
import type { WalkingRoute } from '@hk/contracts';
import type { useRouteComparison } from './use-route-comparison';
import { connectionMentions, routeDifference, walkingProfiles } from './route-comparison';

export function RouteComparison({
  comparison,
  selected,
  onSelect,
  onExpand,
}: {
  comparison: ReturnType<typeof useRouteComparison>;
  selected: WalkingRoute;
  onSelect: (route: WalkingRoute) => void;
  onExpand?: () => void;
}) {
  const recommended = comparison.choices.recommended;
  const baseline = recommended?.status === 'ready' ? recommended.route : undefined;
  return (
    <section className="route-comparison" aria-label="Government route comparison">
      <button
        className="route-comparison-toggle"
        aria-expanded={comparison.expanded}
        onClick={() => {
          if (!comparison.expanded) onExpand?.();
          void comparison.toggle();
        }}
      >
        <span>
          <strong>{comparison.expanded ? 'Hide route comparison' : 'Compare routes'}</strong>
          <small>
            Using{' '}
            {walkingProfiles.find((profile) => profile.id === selected.request.profile)?.label} · 3
            government profiles
          </small>
        </span>
        <ChevronDown size={18} />
      </button>
      {comparison.expanded && (
        <>
          <p className="comparison-note">
            Time and distance are government estimates. Connection counts are instruction mentions,
            not verified equipment or a complete barrier audit. Lift operation, closures and access
            hours are unknown.
          </p>
          <div className="route-choice-list" aria-label="Route alternatives">
            {walkingProfiles.map(({ id, label, description }) => {
              const choice = comparison.choices[id];
              const route = choice?.status === 'ready' ? choice.route : undefined;
              const active = selected.request.profile === id;
              const mentions = route ? connectionMentions(route) : [];
              const difference = route ? routeDifference(route, baseline) : null;
              const barrierConflict =
                id === 'barrier-free' &&
                mentions.some((row) => row.kind === 'stairs' || row.kind === 'escalator');
              return (
                <article
                  className="route-choice"
                  key={id}
                  data-selected={active}
                  aria-label={`${label} route`}
                >
                  <h3>
                    {label}
                    {active && (
                      <span>
                        <Check size={15} /> Selected
                      </span>
                    )}
                  </h3>
                  <small>{description}</small>
                  {route ? (
                    <>
                      <div className="route-choice-metrics">
                        <strong>{Math.round(route.distanceM)} m</strong>
                        <strong>about {Math.max(1, Math.round(route.durationMinutes))} min</strong>
                      </div>
                      {difference && <p className="comparison-note">{difference}</p>}
                      {mentions.length ? (
                        <ul
                          className="connection-mentions"
                          aria-label="Source instruction mentions"
                        >
                          {mentions.map(({ kind, label, count }) => (
                            <li key={kind}>
                              {label}: {count} {count === 1 ? 'instruction' : 'instructions'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="comparison-note">
                          No recognised connection instructions. Accessibility remains unknown.
                        </p>
                      )}
                      {barrierConflict && (
                        <p className="comparison-caution">
                          This Barrier-free result mentions stairs or escalators. Do not assume a
                          step-free journey; check the source directions.
                        </p>
                      )}
                      <details className="comparison-connections">
                        <summary>Connections & source notes</summary>
                        <p>From: {route.request.start.name}</p>
                        <p>To: {route.request.end.name}</p>
                        <p>
                          Unrouted gaps: {Math.round(route.endpointOffsetsM[0])} m at start ·{' '}
                          {Math.round(route.endpointOffsetsM[1])} m at destination. Check these
                          connections separately.
                        </p>
                        {route.warnings.map((warning, index) => (
                          <p key={index}>{warning}</p>
                        ))}
                        <p>
                          Fetched {new Date(route.fetchedAt).toLocaleString()} · source update time
                          unavailable.
                        </p>
                      </details>
                      <button
                        className="route-choice-select"
                        aria-pressed={active}
                        onClick={() => onSelect(route)}
                      >
                        {active ? `Using ${label}` : `Use ${label}`}
                      </button>
                    </>
                  ) : choice?.status === 'error' ? (
                    <>
                      <p role="alert" className="navigation-error">
                        {choice.error}
                      </p>
                      <button className="text-button" onClick={() => void comparison.retry(id)}>
                        Retry {label}
                      </button>
                    </>
                  ) : (
                    <p role="status">Finding {label} route…</p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
