export interface IndoorCamera {
  x: number;
  y: number;
  scale: number;
  rotation?: number;
}
/** Zoom around a screen point instead of pulling the plan away from the user's fingers. */
export function zoomIndoorCamera(camera: IndoorCamera, factor: number, x = 0, y = 0): IndoorCamera {
  const scale = Math.max(1, Math.min(8, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { ...camera, scale, x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio };
}

/** Rotate in screen space around the gesture centre without moving the touched point. */
export function rotateIndoorCamera(
  camera: IndoorCamera,
  delta: number,
  x = 0,
  y = 0,
): IndoorCamera {
  const radians = (delta * Math.PI) / 180;
  const dx = camera.x - x,
    dy = camera.y - y;
  return {
    ...camera,
    rotation: (camera.rotation ?? 0) + delta,
    x: x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: y + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}
export function angleDelta(before: number, after: number) {
  return ((((after - before) % 360) + 540) % 360) - 180;
}
