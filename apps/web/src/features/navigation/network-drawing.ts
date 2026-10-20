import type { NetworkSegment, WalkingRoute } from '@hk/contracts';

/** A local diagram avoids treating HKPD gravity heights as Cesium ellipsoidal heights. */
export function networkDrawing(
  segments: NetworkSegment[],
  heights: boolean,
  route?: WalkingRoute['paths'],
) {
  const entries: { segment: NetworkSegment | null; paths: NetworkSegment['paths'] }[] =
    segments.map((segment) => ({ segment, paths: segment.paths }));
  // The route is a horizontal reference only; its vertical datum is not joined to HKPD.
  if (!heights && route) entries.push({ segment: null, paths: route });
  const all = entries.flatMap((s) => s.paths.flat());
  if (!all.length) return [];
  const origin = all[0];
  const project = ([lng, lat, z]: (typeof all)[number]) => {
    const x = (lng - origin[0]) * 103000,
      y = (lat - origin[1]) * 111200;
    return heights ? [0.86 * (x - y), 0.34 * (x + y) - (z ?? 0) * 3] : [x, -y];
  };
  const projected = all.filter((p) => !heights || p[2] !== null).map(project);
  if (!projected.length) return [];
  const minX = Math.min(...projected.map((p) => p[0])),
    maxX = Math.max(...projected.map((p) => p[0]));
  const minY = Math.min(...projected.map((p) => p[1])),
    maxY = Math.max(...projected.map((p) => p[1]));
  const scale = Math.min(312 / Math.max(1, maxX - minX), 200 / Math.max(1, maxY - minY));
  const x = (p: number) => 180 + (p - (minX + maxX) / 2) * scale;
  const y = (p: number) => 120 + (p - (minY + maxY) / 2) * scale;
  return entries.map(({ segment, paths }) => ({
    segment,
    d: paths
      .map((path) => {
        let connected = false;
        return path
          .map((point) => {
            if (heights && point[2] === null) {
              connected = false;
              return '';
            }
            const p = project(point),
              command = `${connected ? 'L' : 'M'}${x(p[0]).toFixed(2)},${y(p[1]).toFixed(2)}`;
            connected = true;
            return command;
          })
          .join(' ');
      })
      .join(' '),
  }));
}
