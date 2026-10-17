export interface LabelBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
  group?: string;
}
/** Greedy screen-space layout: important nearby labels win, with room between touch targets. */
export function layoutLabels(
  candidates: LabelBox[],
  bounds: { width: number; height: number; top: number; bottom: number },
  limit: number,
  groupLimits: Record<string, number> = {},
): LabelBox[] {
  const centreY = (bounds.top + bounds.height - bounds.bottom) / 2;
  const distance = (box: LabelBox) => Math.hypot(box.x - bounds.width / 2, box.y - centreY);
  const accepted: LabelBox[] = [];
  for (const box of [...candidates].sort(
    (a, b) => b.priority - a.priority || distance(a) - distance(b) || a.id.localeCompare(b.id),
  )) {
    if (
      box.group &&
      accepted.filter((other) => other.group === box.group).length >=
        (groupLimits[box.group] ?? Infinity)
    )
      continue;
    const left = box.x - box.width / 2,
      right = box.x + box.width / 2;
    if (
      left < 12 ||
      right > bounds.width - 12 ||
      box.y - box.height < bounds.top + 12 ||
      box.y > bounds.height - bounds.bottom - 12
    )
      continue;
    if (
      accepted.some(
        (other) =>
          Math.abs(box.x - other.x) < (box.width + other.width) / 2 + 8 &&
          box.y > other.y - other.height - 8 &&
          box.y - box.height < other.y + 8,
      )
    )
      continue;
    accepted.push(box);
    if (accepted.length === limit) break;
  }
  return accepted;
}
