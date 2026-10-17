import type { WalkingRoute } from '@hk/contracts';
import type { endpointStation } from './station-endpoint';
export function StationStartChoice({
  station,
  route,
  onChoose,
  onCurrent,
}: {
  station: NonNullable<ReturnType<typeof endpointStation>>;
  route?: WalkingRoute;
  onChoose: () => void;
  onCurrent: () => void;
}) {
  return (
    <section className="station-reference-choice" aria-label="Station starting point">
      <details>
        <summary>{station.name} · assumed concourse · change</summary>
        <p>
          Starting from a mapped concourse connection. Your actual position and floor are unknown.
        </p>
        <div className="station-start-actions">
          <button className="text-button" onClick={onChoose}>
            Choose entrance or floor
          </button>
          <button className="text-button" onClick={onCurrent}>
            Use current location
          </button>
        </div>
        {route?.request.start.assumedConcourse && <p>{route.request.start.name}</p>}
      </details>
    </section>
  );
}
