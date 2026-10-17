import type { IndoorPoint } from '@hk/contracts';

/** Display shorthand only; preserve the complete source name in the exit list. */
export function exitCode(name: string) {
  return (
    name
      .replace(/^exit\s*/i, '')
      .replace(/出口$/, '')
      .trim() || name
  );
}

export function stationExits(points: IndoorPoint[], destination?: { lat: number; lng: number }) {
  return points
    .filter((point) => point.category === 'entry')
    .map((point) => {
      const rad = Math.PI / 180;
      const a = destination
        ? Math.sin(((destination.lat - point.lat) * rad) / 2) ** 2 +
          Math.cos(point.lat * rad) *
            Math.cos(destination.lat * rad) *
            Math.sin(((destination.lng - point.lng) * rad) / 2) ** 2
        : undefined;
      return {
        point,
        distanceM: a === undefined ? undefined : 12742000 * Math.asin(Math.min(1, Math.sqrt(a))),
      };
    })
    .sort((a, b) =>
      a.distanceM !== undefined && b.distanceM !== undefined
        ? a.distanceM - b.distanceM || a.point.name.localeCompare(b.point.name)
        : a.point.name.localeCompare(b.point.name, 'en', { numeric: true }),
    );
}
