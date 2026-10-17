import type { IndoorFloor, IndoorStation, WalkingRoute } from '@hk/contracts';
import { NavigationIcon } from './NavigationIcon';
import { instructionTransition } from './navigation-symbols';
/** Source text must explicitly name this station and level; do not infer a manoeuvre from Z. */
export function StationFloorInstructions({
  route,
  venue,
  floor,
  compact = false,
}: {
  route: WalkingRoute;
  venue: IndoorStation;
  floor: IndoorFloor;
  compact?: boolean;
}) {
  const key = (text: string) => text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const phrase = key(`${venue.name} ${floor.name}`);
  const matches = route.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => key(step.text).includes(phrase));
  if (!matches.length) return null;
  const first = matches[0].step;
  // A route may revisit a floor. Do not skip its first connection by jumping to the last visit.
  let last = matches[0].index;
  while (route.steps[last + 1] && key(route.steps[last + 1].text).includes(phrase)) last++;
  const next = route.steps[last + 1];
  if (compact) {
    const step = next ?? first;
    const transition = instructionTransition(step.text);
    return (
      <div className="station-next-connection">
        <NavigationIcon kind={transition ?? 'walk'} />
        <span>
          <small>{transition ? 'Next connection' : 'Next section'}</small>
          <strong>{step.text}</strong>
        </span>
      </div>
    );
  }
  return (
    <div className="station-floor-instructions" aria-label="Source instructions for this floor">
      <div>
        <NavigationIcon kind={instructionTransition(first.text) ?? 'walk'} />
        <span>
          <small>First instruction on this level</small>
          <strong>{first.text}</strong>
        </span>
      </div>
      {next && (
        <div>
          <NavigationIcon kind={instructionTransition(next.text) ?? 'walk'} />
          <span>
            <small>Then</small>
            <strong>{next.text}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
