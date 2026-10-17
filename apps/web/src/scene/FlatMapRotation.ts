import type { CesiumWidget } from 'cesium';

/** Flat mode disables Cesium tilt, including its twist gesture. Restore heading only. */
export function installFlatMapRotation(widget: CesiumWidget, enabled: () => boolean) {
  const canvas = widget.canvas;
  let angle: number | undefined;
  let pair = '';
  const update = (event: TouchEvent) => {
    if (!enabled() || event.touches.length !== 2) {
      angle = undefined;
      pair = '';
      return;
    }
    const [a, b] = Array.from(event.touches).sort((a, b) => a.identifier - b.identifier);
    const nextPair = `${a.identifier}:${b.identifier}`;
    const next = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
    if (angle !== undefined && pair === nextPair) {
      const delta = Math.atan2(Math.sin(next - angle), Math.cos(next - angle));
      const camera = widget.camera;
      camera.setView({
        orientation: { heading: camera.heading - delta, pitch: -Math.PI / 2, roll: 0 },
      });
      widget.scene.requestRender();
    }
    angle = next;
    pair = nextPair;
  };
  // Passive listeners leave Cesium's pan/pinch handling intact.
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
    canvas.addEventListener(type, update as EventListener, { passive: true });
  return () => {
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
      canvas.removeEventListener(type, update as EventListener);
  };
}
