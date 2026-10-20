import type { StationRouteContext, WalkingRoute } from '@hk/contracts';
import { instructionTransition } from './navigation-symbols';

export interface JourneyMapTarget {
  venueId: string;
  venueName: string;
  levelId: string | null;
  levelName: string | null;
}
export interface JourneyStep {
  instruction: WalkingRoute['steps'][number];
  map: JourneyMapTarget | null;
}

const words = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const contains = (text: string, phrase: string) => {
  if (!phrase) return false;
  if (/\p{Script=Han}/u.test(phrase))
    return text.replaceAll(' ', '').includes(phrase.replaceAll(' ', ''));
  return ` ${text} `.includes(` ${phrase} `);
};

/** Link explicit source names only. Neither GPS nor a neighbouring step supplies a floor. */
export function journeySteps(route: WalkingRoute, contexts: StationRouteContext[]): JourneyStep[] {
  const steps: JourneyStep[] = route.steps.map((instruction) => {
    const text = words(instruction.text);
    const venues = contexts.filter(({ venue }) =>
      [venue.name, venue.nameZh].some((name) => contains(text, words(name))),
    );
    if (venues.length !== 1) return { instruction, map: null };
    const context = venues[0];
    const floors = context.floors.filter((floor) => {
      const names = [floor.name, floor.nameZh].filter(Boolean);
      if (/^(ground floor|ground level|gf|g)$/i.test(floor.name))
        names.push('Level G', 'Ground Floor', 'Ground Level');
      return names.some((name) =>
        [context.venue.name, context.venue.nameZh].some((venueName) =>
          venueName ? contains(text, words(`${venueName} ${name}`)) : false,
        ),
      );
    });
    const floor = floors.length === 1 ? floors[0] : undefined;
    return {
      instruction,
      map: {
        venueId: context.venue.id,
        venueName: context.venue.name,
        levelId: floor?.id ?? null,
        levelName: floor?.name ?? null,
      },
    };
  });
  return steps.map((step, index) => {
    const before = steps[index - 1]?.map;
    const after = steps[index + 1]?.map;
    // An explicit connector between two instructions in one venue stays in that view.
    // The connector has no assigned floor or asserted feature location.
    if (
      !step.map &&
      instructionTransition(step.instruction.text) &&
      before &&
      before.venueId === after?.venueId
    )
      return { ...step, map: { ...before, levelId: null, levelName: null } };
    return step;
  });
}

export function sameJourneyFloor(a: JourneyMapTarget | null, b: JourneyMapTarget | null) {
  return !!a?.levelId && a.venueId === b?.venueId && a.levelId === b.levelId;
}
