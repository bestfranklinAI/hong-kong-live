import type { IndoorPoint, IndoorFloor, IndoorLayout } from '@hk/contracts';
/** Transient picker session; callbacks are discarded when its level or endpoint changes. */
export interface IndoorMapChoice {
  layout?: IndoorLayout;
  floor?: IndoorFloor;
  points: IndoorPoint[];
  stationName: string;
  levelName: string;
  select: (point: IndoorPoint) => void;
}

export const indoorCategoryLabels: Record<IndoorPoint['category'], string> = {
  entry: 'Exit / entry',
  elevator: 'Lift',
  platform: 'Platform',
  ramp: 'Ramp',
  stairs: 'Stairs',
  escalator: 'Escalator',
};
