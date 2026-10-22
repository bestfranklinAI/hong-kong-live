import { ArrowLeft, ArrowRight, Check, ChevronDown, Map } from 'lucide-react';
import { NavigationIcon } from './NavigationIcon';
import { instructionLevel } from './instruction-level';
import { instructionSymbol, instructionTransition, transitionLabels } from './navigation-symbols';
import type { useJourneyGuidance } from './use-journey-guidance';

/** City and indoor views share progress; level changes stay explicit. */
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
  const level = map?.levelName ?? instructionLevel(step.instruction.text);
  const transition = instructionTransition(step.instruction.text);
  const showManual =
    !compact || !journey.automatic || journey.needsCheck || complete || index === steps.length - 1;
  const viewingFloor =
    !!map?.levelId && map.venueId === viewedFloor?.venueId && map.levelId === viewedFloor?.levelId;
  if (compact) {
    const mapLabel = map
      ? `View ${map.venueName}${map.levelName ? ` · ${map.levelName}` : ''}`
      : 'View city map';
    return (
      <section
        className="journey-guide journey-guide-compact"
        aria-label="Continuous journey guidance"
      >
        {/* Expanding preserves the exact source text; each new step starts collapsed. */}
        <details className="journey-current" key={`${index}:${step.instruction.text}`}>
          <summary aria-label={`Current direction: ${step.instruction.text}`}>
            <NavigationIcon
              kind={instructionSymbol(step.instruction.text, step.instruction.maneuver)}
            />
            <strong aria-live="polite" aria-atomic="true">
              {step.instruction.text}
            </strong>
            <ChevronDown size={16} className="journey-expand" />
          </summary>
          <div className="journey-current-details">
            <span>{complete ? 'Journey complete' : `Step ${index + 1} of ${steps.length}`}</span>
            <button
              aria-label="Previous journey step"
              disabled={index === 0 && !complete}
              onClick={() => onMove(-1)}
            >
              <ArrowLeft size={18} /> Back
            </button>
            {journey.needsCheck && <p>Check signs and levels. GPS cannot identify your floor.</p>}
          </div>
        </details>
        {(map || level || transition || showManual) && (
          <div className="journey-compact-actions">
            {map && !viewingFloor && (
              <button
                className="journey-context-map"
                onClick={onView}
                aria-label={mapLabel}
                title={mapLabel}
              >
                <Map size={18} />
              </button>
            )}
            {(!map?.levelId || confirmed) && (
              <span className="journey-context-level" role="status">
                {confirmed && <Check size={14} />}
                {level ||
                  (transition ? transitionLabels[transition] : map ? 'Check floor signs' : '')}
                {!confirmed && level && <small>Check signs</small>}
              </span>
            )}
            {map?.levelId && !confirmed ? (
              <button
                className="journey-confirm"
                onClick={() => journey.confirm(map.venueId, map.levelId!)}
              >
                I’m on {map.levelName}
              </button>
            ) : (
              showManual && (
                <button
                  className="journey-continue"
                  disabled={!canContinue || complete}
                  onClick={() => onMove(1)}
                >
                  {complete ? 'Complete' : index === steps.length - 1 ? 'Finish journey' : 'Next'}
                  {!complete && <ArrowRight size={18} />}
                </button>
              )
            )}
          </div>
        )}
        {journey.loading && (
          <p className="journey-note" role="status">
            Loading floor plans…
          </p>
        )}
      </section>
    );
  }
  return (
    <section className="journey-guide" aria-label="Continuous journey guidance">
      <div className="journey-instruction" aria-live="polite" aria-atomic="true">
        <NavigationIcon
          kind={instructionSymbol(step.instruction.text, step.instruction.maneuver)}
        />
        <div>
          <small>
            {complete
              ? 'Journey marked complete · manually'
              : `Step ${index + 1} of ${steps.length}${journey.automatic ? ' · GPS guidance' : ' · manual progress'}`}
          </small>
          <strong>{step.instruction.text}</strong>
        </div>
      </div>
      {(level || transition) && (
        <div className="journey-level-cue" role="status">
          <strong>
            {transition ? transitionLabels[transition] : 'Route level'}
            {level ? ` · ${level}` : ''}
          </strong>
          <span>
            {level === 'Footbridge' ? 'Check bridge access and level signs' : 'Check level signs'}
          </span>
        </div>
      )}
      <button className="journey-map-action" onClick={onView}>
        <Map size={18} />
        {map
          ? `View ${map.venueName}${map.levelName ? ` · ${map.levelName}` : ''}`
          : 'View city map'}
      </button>
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
      {steps[index + 1] && (
        <p className="journey-next">Next: {steps[index + 1].instruction.text}</p>
      )}
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
    </section>
  );
}
