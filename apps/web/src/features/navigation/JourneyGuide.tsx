import { ArrowLeft, ArrowRight, Check, Map } from 'lucide-react';
import { NavigationIcon } from './NavigationIcon';
import { instructionSymbol } from './navigation-symbols';
import type { useJourneyGuidance } from './use-journey-guidance';

/** One manual cursor is shared by the planner, walking card and indoor plans. */
export function JourneyGuide({
  journey,
  onView,
  onMove,
  viewedFloor,
  compact = false,
}: {
  journey: ReturnType<typeof useJourneyGuidance>;
  onView: () => void;
  onMove: (delta: -1 | 1) => void;
  compact?: boolean;
  viewedFloor?: { venueId: string; levelId: string };
}) {
  const { step, steps, index, confirmed, complete, canContinue } = journey;
  if (!step) return null;
  const map = step.map;
  const viewingFloor =
    !!map?.levelId && map.venueId === viewedFloor?.venueId && map.levelId === viewedFloor?.levelId;
  return (
    <section
      className={`journey-guide ${compact ? 'journey-guide-compact' : ''}`}
      aria-label="Continuous journey guidance"
    >
      <div className="journey-instruction" aria-live="polite" aria-atomic="true">
        <NavigationIcon
          kind={instructionSymbol(step.instruction.text, step.instruction.maneuver)}
        />
        <div>
          <small>
            {complete
              ? 'Journey marked complete · manually'
              : `Step ${index + 1} of ${steps.length}${compact ? '' : ' · manual progress'}`}
          </small>
          <strong>{step.instruction.text}</strong>
        </div>
      </div>
      {(!compact || (map && !viewingFloor)) && (
        <button className="journey-map-action" onClick={onView}>
          <Map size={18} />
          {map
            ? `View ${map.venueName}${map.levelName ? ` · ${map.levelName}` : ''}`
            : 'View city map'}
        </button>
      )}
      {journey.loading && (
        <p className="journey-note" role="status">
          Preparing indoor sections…
        </p>
      )}
      {map?.levelId && (
        <div className="journey-floor-confirmation">
          {confirmed ? (
            <p role="status">
              <Check size={16} /> You confirmed {map.levelName}
            </p>
          ) : (
            <>
              <p>Check the floor signs. GPS cannot identify your floor.</p>
              <button
                onClick={() =>
                  viewingFloor ? journey.confirm(map.venueId, map.levelId!) : onView()
                }
              >
                {viewingFloor ? `I’m on ${map.levelName}` : 'Open floor plan to confirm'}
              </button>
            </>
          )}
        </div>
      )}
      {map && !map.levelId && (
        <p className="journey-note">
          No unique floor match. Check the source directions and signs.
        </p>
      )}
      <div className="journey-actions">
        <button
          aria-label="Previous journey step"
          disabled={index === 0 && !complete}
          onClick={() => onMove(-1)}
        >
          <ArrowLeft size={18} /> Back
        </button>
        <button disabled={!canContinue || complete} onClick={() => onMove(1)}>
          {index === steps.length - 1 ? 'Finish journey' : 'Continue'} <ArrowRight size={18} />
        </button>
      </div>
      {!compact && steps[index + 1] && (
        <p className="journey-next">Next: {steps[index + 1].instruction.text}</p>
      )}
      {!compact && (
        <details className="journey-sequence">
          <summary>Whole journey · source directions</summary>
          <ol>
            {steps.map((item, i) => (
              <li key={i} aria-current={i === index ? 'step' : undefined}>
                {item.instruction.text}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
