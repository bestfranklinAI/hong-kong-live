/** Screen grouping only; never asserts that nearby points are connected or on the same path. */
export function groupFloorPoints<T>(points: T[], project: (point: T) => number[], spacing: number) {
  const groups: Array<{ x: number; y: number; points: T[] }> = [];
  for (const point of points) {
    const [x, y] = project(point);
    const group = groups.find((group) => Math.hypot(group.x - x!, group.y - y!) < spacing);
    if (group) group.points.push(point);
    else groups.push({ x: x!, y: y!, points: [point] });
  }
  return groups;
}
