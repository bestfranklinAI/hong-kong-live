import type { StationRouteContext, WalkingRoute } from '@hk/contracts';
import { ArrowUpDown, ArrowUpRight, ArrowLeft, ArrowRight, Layers } from 'lucide-react';
export function StationRouteJourney({
  context,
  route,
  level,
  onLevel,
  onContinue,
}: {
  context: StationRouteContext;
  route: WalkingRoute;
  level: string;
  onLevel: (id: string) => void;
  onContinue?: () => void;
}) {
  const sequence: Array<{ key: string; kind: 'floor' | 'change'; levelId: string | null }> = [];
  let lastLevel: string | null = null;
  for (const [index, segment] of context.segments.entries()) {
    if (segment.kind === 'level-change') {
      if (sequence.at(-1)?.kind !== 'change')
        sequence.push({ key: `change-${index}`, kind: 'change', levelId: null });
    } else if (
      segment.levelId &&
      (segment.levelId !== lastLevel || sequence.at(-1)?.kind === 'change')
    ) {
      sequence.push({ key: `floor-${index}`, kind: 'floor', levelId: segment.levelId });
      lastLevel = segment.levelId;
    }
  }
  const levels = [...new Set(sequence.flatMap((step) => (step.levelId ? [step.levelId] : [])))];
  const current = levels.indexOf(level);
  const last = context.segments.at(-1)!;
  const continues =
    last.pathIndex < route.paths.length - 1 ||
    last.segmentIndex < route.paths[last.pathIndex].length - 2;
  return (
    <section className="station-route-journey" aria-label="Station route levels">
      <div className="station-level-navigation" aria-label="Route floor navigation">
        <button
          className="icon-button"
          aria-label="Previous route level"
          disabled={current <= 0}
          onClick={() => onLevel(levels[current - 1])}
        >
          <ArrowLeft size={20} />
        </button>
        <span>
          <small>
            {current >= 0
              ? `Level ${current + 1} of ${levels.length}${current < levels.length - 1 ? ' · next' : ' · continue'}`
              : 'Viewing another floor'}
          </small>
          <strong>
            {current < levels.length - 1
              ? (context.floors.find((f) => f.id === levels[current + 1])?.name ??
                'Return to route')
              : 'Continue on the city map'}
          </strong>
        </span>
        {current < levels.length - 1 ? (
          <button
            className="station-next-level"
            aria-label="Next route level"
            onClick={() => onLevel(levels[current + 1])}
          >
            {current < 0 ? 'Route' : 'Next level'}
            <ArrowRight size={20} />
          </button>
        ) : continues && onContinue ? (
          <button className="station-next-level" onClick={onContinue}>
            City map
            <ArrowUpRight size={20} />
          </button>
        ) : (
          <button className="station-next-level" onClick={onContinue}>
            Done
            <ArrowUpRight size={20} />
          </button>
        )}
      </div>
      <details className="station-level-sequence">
        <summary>
          Station journey · {levels.length} mapped {levels.length === 1 ? 'level' : 'levels'}
        </summary>
        <div className="station-route-steps">
          {sequence.map((step) =>
            step.kind === 'floor' ? (
              <button
                key={step.key}
                aria-pressed={level === step.levelId}
                onClick={() => onLevel(step.levelId!)}
              >
                <Layers size={16} />
                {context.floors.find((floor) => floor.id === step.levelId)?.name}
              </button>
            ) : (
              <span key={step.key}>
                <ArrowUpDown size={16} />
                Level change
              </span>
            ),
          )}
        </div>
      </details>
    </section>
  );
}
