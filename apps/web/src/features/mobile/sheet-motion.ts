export type SheetSnap = 'peek' | 'half' | 'full';
export const snapOrder: SheetSnap[] = ['peek', 'half', 'full'];
export function sheetHeights(viewport: number, safeBottom = 0) {
  return {
    peek: Math.min(96 + safeBottom, viewport * 0.4),
    half: viewport * 0.45,
    full: viewport * 0.88,
  };
}
export function chooseSnap(
  height: number,
  velocity: number,
  current: SheetSnap,
  heights: Record<SheetSnap, number>,
): SheetSnap {
  if (Math.abs(velocity) > 0.45) {
    const index = snapOrder.indexOf(current);
    return snapOrder[Math.max(0, Math.min(2, index + (velocity > 0 ? 1 : -1)))];
  }
  return snapOrder.reduce((best, snap) =>
    Math.abs(heights[snap] - height) < Math.abs(heights[best] - height) ? snap : best,
  );
}
export function springStep(position: number, velocity: number, target: number, dt: number) {
  const nextVelocity = velocity + (300 * (target - position) - 25 * velocity) * dt;
  return { position: position + nextVelocity * dt, velocity: nextVelocity };
}
export function haptic() {
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(10);
  } catch {
    /* Unsupported browsers may reject vibration. */
  }
}
