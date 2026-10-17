import type { IndoorFloor, IndoorStation } from './indoor';
export interface StationRouteSegment {
  match?: 'direction-level';
  pathIndex: number;
  segmentIndex: number;
  venueId: string;
  levelId: string | null;
  kind: 'floor' | 'level-change' | 'unassigned';
}
/** A geometric association, not a floor ID explicitly returned by the routing service. */
export interface StationRouteContext {
  venue: IndoorStation & { kind?: 'station' | 'building' };
  floors: IndoorFloor[];
  segments: StationRouteSegment[];
  endpointRoles: Array<'start' | 'end'>;
}
export interface StationRouteView {
  segments: StationRouteSegment[];
  stations: Array<{
    kind?: 'station' | 'building';
    exitName?: string;
    id: string;
    name: string;
    nameZh: string;
    lat: number;
    lng: number;
  }>;
}
