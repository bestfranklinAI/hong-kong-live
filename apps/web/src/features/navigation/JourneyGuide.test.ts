// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { indoorFloorSchema, walkingRouteSchema, type StationRouteContext } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import { JourneyGuide } from './JourneyGuide';
import { useJourneyGuidance } from './use-journey-guidance';

it('keeps one manual journey through map changes, confirms each floor visit, and resets on rerouting', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const original = walkingRouteSchema.parse(sample.route);
  const route = { ...original, steps: [1, 2, 6, 7, 15, 1].map((i) => original.steps[i]) };
  const floors = indoorFloorSchema.array().parse(sample.floors);
  const context: StationRouteContext = {
    venue: { id: floors[0].venueId, name: 'Kowloon Station', nameZh: '九龍鐵路站' },
    floors,
    segments: [],
    endpointRoles: ['start'],
  };
  let replaceRoute: () => void;
  let resolveIndoor: () => void;
  let browseOtherFloor: () => void;
  function Harness() {
    const [currentRoute, setRoute] = useState(route);
    const [loading, setLoading] = useState(true);
    const [viewedFloor, setViewedFloor] = useState<{ venueId: string; levelId: string }>();
    const journey = useJourneyGuidance(currentRoute, loading ? [] : [context], loading);
    replaceRoute = () => setRoute({ ...route, fetchedAt: '2026-10-18T00:00:00Z' });
    resolveIndoor = () => setLoading(false);
    browseOtherFloor = () => setViewedFloor({ venueId: context.venue.id, levelId: floors[0].id });
    function view() {
      const map = journey.step?.map;
      setViewedFloor(map?.levelId ? { venueId: map.venueId, levelId: map.levelId } : undefined);
    }
    return createElement(JourneyGuide, {
      journey,
      viewedFloor,
      onView: view,
      onMove: (delta) => {
        journey.move(delta);
      },
    });
  }
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;
  const click = async (text: string) => act(async () => button(text).click());
  try {
    await act(async () => root.render(createElement(Harness)));
    expect(button('Continue').disabled).toBe(true);
    await act(async () => resolveIndoor());
    expect(button('Continue').disabled).toBe(true);
    await click('Open floor plan to confirm');
    await act(async () => browseOtherFloor());
    // Browsing another mapped floor never confirms the instruction's floor.
    expect(container.textContent).not.toContain('I’m on');
    await click('Open floor plan to confirm');
    await click('I’m on Platform Level 2');
    expect(button('Continue').disabled).toBe(false);
    await click('Continue');
    expect(container.textContent).toContain('Step 2 of 6');
    expect(button('Continue').disabled).toBe(false); // same uninterrupted floor visit
    await click('Continue');
    expect(container.textContent).toContain('Take the elevator');
    expect(container.textContent).not.toContain('You confirmed');
    await click('Continue');
    expect(container.textContent).toContain('Step 4 of 6');
    expect(button('Continue').disabled).toBe(true);
    await click('Open floor plan to confirm');
    await click('I’m on In-town');
    await click('Continue');
    expect(container.textContent).toContain('Step 5 of 6');
    expect(button('View city map')).toBeTruthy();
    await click('View city map');
    expect(container.textContent).toContain('Step 5 of 6');
    await click('Continue');
    // A return to an earlier floor is a new visit, requiring confirmation again.
    expect(button('Finish journey').disabled).toBe(true);
    await click('Open floor plan to confirm');
    await click('I’m on Platform Level 2');
    await click('Finish journey');
    expect(container.textContent).toContain('Journey marked complete · manually');
    await act(async () => replaceRoute());
    expect(container.textContent).toContain('Step 1 of 6');
    expect(button('Continue').disabled).toBe(true);
    expect(container.textContent).not.toContain('You confirmed');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it('keeps compact floor confirmation explicit and reveals controls only for the current section', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const original = walkingRouteSchema.parse(sample.route);
  const route = { ...original, steps: [1, 6, 15].map((i) => original.steps[i]) };
  const floors = indoorFloorSchema.array().parse(sample.floors);
  const context: StationRouteContext = {
    venue: { id: floors[0].venueId, name: 'Kowloon Station', nameZh: '九龍鐵路站' },
    floors,
    segments: [],
    endpointRoles: ['start'],
  };
  const view = vi.fn();
  let returnToStart: () => void;
  function Harness() {
    const journey = useJourneyGuidance(route, [context], false, 2);
    returnToStart = () => journey.move(-1);
    return createElement(JourneyGuide, {
      journey,
      compact: true,
      onView: view,
      onMove: journey.move,
    });
  }
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  try {
    await act(async () => root.render(createElement(Harness)));
    // A GPS cursor already beyond this floor must still wait for an explicit confirmation.
    expect(button('Next')).toBeUndefined();
    expect(button('I’m on Platform Level 2')).toBeTruthy();
    expect(container.querySelector('.journey-current strong')?.textContent).toBe(
      route.steps[0].text,
    );
    const disclosure = container.querySelector('details')!;
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    expect(container.textContent).toContain('GPS cannot identify your floor');
    await act(async () =>
      container.querySelector<HTMLButtonElement>('.journey-context-map')!.click(),
    );
    expect(view).toHaveBeenCalledOnce();
    expect(button('Next')).toBeUndefined(); // Browsing is not confirmation.
    await act(async () => button('I’m on Platform Level 2')!.click());
    await act(async () => button('Next')!.click());
    expect(container.querySelector('details')!.open).toBe(false);
    expect(container.textContent).not.toContain('I’m on'); // A connector has no inferred floor.
    expect(button('Next')).toBeTruthy();
    await act(async () => returnToStart());
    expect(button('I’m on Platform Level 2')).toBeTruthy(); // A new floor visit needs confirmation.
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
