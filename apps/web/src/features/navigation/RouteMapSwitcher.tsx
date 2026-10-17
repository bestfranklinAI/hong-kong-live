import { Building2, Map, TrainFront } from 'lucide-react';
import type { StationRouteContext } from '@hk/contracts';
/** Manual journey views: changing views never asserts the user's indoor position. */
export function RouteMapSwitcher({
  contexts,
  selected,
  onSelect,
}: {
  contexts: StationRouteContext[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!contexts.length) return null;
  return (
    <nav className="route-map-switcher" aria-label="Journey map views">
      <button aria-pressed={!selected} onClick={() => onSelect(null)}>
        <Map size={16} />
        City
      </button>
      {contexts.map((context) => (
        <button
          key={context.venue.id}
          aria-pressed={selected === context.venue.id}
          onClick={() => onSelect(context.venue.id)}
        >
          {context.venue.kind === 'building' ? <Building2 size={16} /> : <TrainFront size={16} />}
          {context.venue.name.replace(/ Station$/i, '')}
        </button>
      ))}
    </nav>
  );
}
