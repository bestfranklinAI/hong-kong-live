import type { WalkingRoute } from '@hk/contracts';
import { NavigationIcon } from './NavigationIcon';
import { instructionTransition, transitionLabels } from './navigation-symbols';
export function RouteDirections({ route }: { route: WalkingRoute }) {
  const steps = route.steps.map((step) => ({ ...step, kind: instructionTransition(step.text) }));
  const transitions = Object.entries(transitionLabels)
    .map(([kind, label]) => ({ kind, label, count: steps.filter((s) => s.kind === kind).length }))
    .filter((x) => x.count);
  return (
    <section className="route-directions" aria-label="Route instructions">
      <div className="route-directions-heading">
        <h3>Your walking route</h3>
        <span>{steps.length} instructions</span>
      </div>
      {transitions.length > 0 && (
        <div className="route-transition-summary" aria-label="Transitions mentioned in directions">
          {transitions.map((t) => (
            <span key={t.kind}>
              <NavigationIcon kind={t.kind as keyof typeof transitionLabels} />
              {t.count} {t.label.toLowerCase()} {t.count === 1 ? 'instruction' : 'instructions'}
            </span>
          ))}
        </div>
      )}
      <ol className="route-timeline">
        {steps.map((step, index) => (
          <li
            key={index}
            className={step.kind ? 'route-step route-step--transition' : 'route-step'}
          >
            <div className="route-step-symbol">
              <NavigationIcon kind={step.kind ?? 'walk'} />
              <span>{index + 1}</span>
            </div>
            <div className="route-step-content">
              <span className="route-step-label">
                {index === 0
                  ? 'Start'
                  : index === steps.length - 1
                    ? 'Arrive'
                    : step.kind
                      ? transitionLabels[step.kind]
                      : 'Walk'}
              </span>
              <p>{step.text}</p>
              {step.distanceM > 0 && (
                <small>{Math.round(step.distanceM)} m · source segment distance</small>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
