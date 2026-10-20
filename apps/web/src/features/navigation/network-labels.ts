import type { NetworkSegment } from '@hk/contracts';

/** Public source “Subway” means a pedestrian underpass, not a train service. */
export const networkKinds = [
  { value: 'Footbridge', label: 'Footbridges', singular: 'Footbridge' },
  { value: 'Subway', label: 'Pedestrian underpasses', singular: 'Pedestrian underpass' },
  { value: 'Lift', label: 'Lifts', singular: 'Lift' },
  { value: 'Stairs', label: 'Stairs', singular: 'Stairs' },
  { value: 'Escalator', label: 'Escalators', singular: 'Escalator' },
  { value: 'Ramp', label: 'Ramps', singular: 'Ramp' },
  { value: 'Stairlift', label: 'Stairlifts', singular: 'Stairlift' },
] as const;
export type NetworkKind = 'all' | (typeof networkKinds)[number]['value'];
export function networkKindLabel(kind: string) {
  return networkKinds.find((row) => row.value === kind)?.singular ?? 'Walkway';
}
export function networkSectionName(segment: NetworkSegment) {
  const name = segment.name || segment.nameZh || '';
  return [segment.kind, networkKindLabel(segment.kind)].some(
    (label) => label.toLowerCase() === name.toLowerCase(),
  )
    ? ''
    : name;
}
