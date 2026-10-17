import { Building2, TrainFront, ChevronRight } from 'lucide-react';
import type { StationRouteContext } from '@hk/contracts';
export function StationRouteCards({
  contexts,
  onInspect,
}: {
  contexts: StationRouteContext[];
  onInspect: (id: string) => void;
}) {
  if (!contexts.length) return null;
  return (
    <div className="station-route-cards" aria-label="Station route sections">
      {contexts.map((context) => {
        const levels = new Set(
          context.segments.flatMap((segment) => (segment.levelId ? [segment.levelId] : [])),
        ).size;
        return (
          <button key={context.venue.id} onClick={() => onInspect(context.venue.id)}>
            {context.venue.kind === 'building' ? <Building2 size={22} /> : <TrainFront size={22} />}
            <span>
              <strong>Through {context.venue.name}</strong>
              <small>
                {levels ? `${levels} mapped ${levels === 1 ? 'level' : 'levels'}` : 'Station area'}{' '}
                · view floor-by-floor
              </small>
            </span>
            <ChevronRight size={18} />
          </button>
        );
      })}
    </div>
  );
}
