// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { indoorFloorSchema, walkingRouteSchema } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import { StationFloorInstructions } from './StationFloorInstructions';
it('shows source lift/escalator instructions for the named floor and does not invent instructions for an unmentioned floor', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const route = walkingRouteSchema.parse(sample.route),
    floors = indoorFloorSchema.array().parse(sample.floors);
  const venue = { id: sample.floors[0].venueId, name: 'Kowloon Station', nameZh: '九龍鐵路站' };
  try {
    const render = async (name: string) =>
      act(async () =>
        root.render(
          createElement(StationFloorInstructions, {
            route,
            venue,
            floor: floors.find((floor) => floor.name === name)!,
          }),
        ),
      );
    await render('Platform Level 2 (Airport Express)');
    expect(container.textContent).toContain('Take the elevator');
    expect(container.textContent).not.toContain('Take the escalator');
    await render('In-town Check In Level');
    expect(container.textContent).toContain('Take the escalator');
    await render('Platform Level 1 (Airport Express)');
    expect(container.textContent).toBe('');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
