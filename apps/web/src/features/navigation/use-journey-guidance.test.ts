// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { walkingRouteSchema } from '@hk/contracts';
import fixture from '../../../../../fixtures/providers/admiralty-routing-audit-2026-09-26.json';
import { useJourneyGuidance } from './use-journey-guidance';

const original = walkingRouteSchema.parse(fixture.routes['eal-ground']);
const route = {
  ...original,
  steps: [
    'Go straight',
    'Take the escalator to the footbridge',
    'Continue along the footbridge',
    'Turn right',
    'Arrive',
  ].map((text) => ({ text, distanceM: 20, durationMinutes: 1 })),
};
let root: Root;
let journey: ReturnType<typeof useJourneyGuidance>;
function Harness({ index, loading = false }: { index?: number; loading?: boolean }) {
  journey = useJourneyGuidance(route, [], loading, index);
  return null;
}
async function render(index?: number, loading = false) {
  await act(async () => root.render(createElement(Harness, { index, loading })));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(document.body.appendChild(document.createElement('div')));
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
it('follows GPS outdoors but never skips an escalator or bridge-level check', async () => {
  await render(0);
  expect(journey.index).toBe(0);
  await render(4);
  expect(journey.index).toBe(1);
  expect(journey.needsCheck).toBe(true);
  await act(async () => {
    journey.move(1);
  });
  expect(journey.index).toBe(2);
  await act(async () => {
    journey.move(1);
  });
  expect(journey.index).toBe(4);
  expect(journey.automatic).toBe(true);
  await render(0);
  expect(journey.index).toBe(4); // a drifting backward fix does not rewind instructions
});
it('waits for indoor context and preserves manual operation when GPS is unavailable', async () => {
  await render(4, true);
  expect(journey.index).toBe(0);
  await render(undefined);
  expect(journey.automatic).toBe(false);
  await act(async () => {
    journey.move(1);
  });
  expect(journey.index).toBe(1);
  await render(undefined);
  expect(journey.index).toBe(1);
});
