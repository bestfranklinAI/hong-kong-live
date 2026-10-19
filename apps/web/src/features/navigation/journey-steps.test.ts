import { expect, it } from 'vitest';
import { indoorFloorSchema, walkingRouteSchema, type StationRouteContext } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import { journeySteps } from './journey-steps';

const route = walkingRouteSchema.parse(sample.route);
const floors = indoorFloorSchema.array().parse(sample.floors);
const context: StationRouteContext = {
  venue: { id: floors[0].venueId, name: 'Kowloon Station', nameZh: '九龍鐵路站' },
  floors,
  segments: [],
  endpointRoles: ['start'],
};

it('preserves the complete captured journey, including exits, mall, footbridge and streets', () => {
  const steps = journeySteps(route, [context]);
  expect(steps.map((step) => step.instruction)).toEqual(route.steps);
  expect(steps[1].map?.levelName).toBe('Platform Level 2 (Airport Express)');
  expect(steps[6].instruction.text).toBe('Take the elevator');
  expect(steps[6].map).toMatchObject({ venueId: context.venue.id, levelId: null });
  expect(steps[7].map?.levelName).toBe('In-town Check In Level');
  expect(steps[11].map?.levelName).toBe('Exit C1 Concourse Level (Tung Chung Line)');
  expect(steps[13].instruction.text).toContain('Elements');
  expect(steps[13].map).toBeNull();
  expect(steps[15].instruction.text).toContain('Footbridge');
  expect(steps[15].map).toBeNull();
  expect(steps.find((step) => step.instruction.text.includes('Canton Road'))?.map).toBeNull();
});

it('links a named intermediate building without requiring it to be an endpoint', () => {
  const building: StationRouteContext = {
    ...context,
    venue: { id: 'elements', name: 'Elements', nameZh: '圓方', kind: 'building' },
    floors: [{ ...floors[0], id: 'l1', venueId: 'elements', name: 'Elements (L1)' }],
    endpointRoles: [],
  };
  expect(journeySteps(route, [context, building])[13].map).toMatchObject({
    venueId: 'elements',
    levelId: 'l1',
  });
});

it('does not pick between ambiguous floors or venues or borrow a connector floor', () => {
  const duplicate = { ...floors[3], id: 'duplicate' };
  const ambiguous = { ...context, floors: [...floors, duplicate] };
  expect(journeySteps(route, [ambiguous])[1].map?.levelId).toBeNull();
  expect(
    journeySteps(route, [context, { ...context, venue: { ...context.venue, id: 'other' } }])[1].map,
  ).toBeNull();
  const disconnected = { ...route, steps: [route.steps[1], route.steps[6], route.steps[13]] };
  expect(journeySteps(disconnected, [context])[1].map).toBeNull();
});

it('supports Traditional Chinese source names and refuses partial numbered floor names', () => {
  const bilingual = {
    ...route,
    steps: [
      { ...route.steps[1], text: '沿九龍鐵路站月台2 (機場快綫)前行' },
      { ...route.steps[1], text: 'Go on Kowloon Station Level 10' },
    ],
  };
  expect(journeySteps(bilingual, [context])[0].map?.levelId).toBe(floors[3].id);
  const numbered = { ...context, floors: [{ ...floors[0], name: 'Level 1', nameZh: '' }] };
  expect(journeySteps(bilingual, [numbered])[1].map?.levelId).toBeNull();
});

it('keeps all source instructions usable when indoor coverage is unavailable', () => {
  const steps = journeySteps(route, []);
  expect(steps).toHaveLength(route.steps.length);
  expect(steps.every((step) => step.map === null)).toBe(true);
  expect(journeySteps({ ...route, steps: [] }, [context])).toEqual([]);
});
