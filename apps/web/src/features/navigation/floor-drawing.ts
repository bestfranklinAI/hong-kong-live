import type { IndoorFloor, IndoorPoint } from '@hk/contracts';
/** One shared projection keeps source geometry, route framing and screen markers aligned. */
export function floorDrawing(floor: IndoorFloor, points: IndoorPoint[]) {
  const coordinates = floor.polygons.flat(2);
  const [lng0, lat0] = coordinates[0];
  const project = (p: number[]) => [
    (p[0] - lng0) * Math.cos((lat0 * Math.PI) / 180),
    -(p[1] - lat0),
  ];
  const xy = [
    ...coordinates.map(project),
    ...points.map((point) => project([point.lng, point.lat])),
  ];
  const minX = Math.min(...xy.map((p) => p[0])),
    minY = Math.min(...xy.map((p) => p[1]));
  const width = Math.max(...xy.map((p) => p[0])) - minX,
    height = Math.max(...xy.map((p) => p[1])) - minY;
  const scale = 280 / Math.max(width, height, 0.000001);
  return (p: number[]) => {
    const [x, y] = project(p);
    return [
      20 + (x - minX) * scale + (280 - width * scale) / 2,
      20 + (y - minY) * scale + (280 - height * scale) / 2,
    ];
  };
}
export function floorRouteCamera(floor: IndoorFloor, points: IndoorPoint[], paths: number[][][]) {
  const vertices = paths.flat();
  if (!vertices.length) return undefined;
  const display = floorDrawing(floor, points);
  const xy = vertices.map(display);
  const minX = Math.min(...xy.map((p) => p[0])),
    maxX = Math.max(...xy.map((p) => p[0]));
  const minY = Math.min(...xy.map((p) => p[1])),
    maxY = Math.max(...xy.map((p) => p[1]));
  return {
    x: (minX + maxX) / 640,
    y: (minY + maxY) / 640,
    scale: Math.max(1, Math.min(8, 230 / Math.max(maxX - minX, maxY - minY, 32))),
  };
}
