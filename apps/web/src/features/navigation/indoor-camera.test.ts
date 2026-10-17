import { expect, it } from 'vitest';
import { angleDelta, rotateIndoorCamera, zoomIndoorCamera } from './indoor-camera';
it('keeps the touched plan point fixed during zoom and clamps magnification', () => {
  const camera = { x: 20, y: -10, scale: 2 };
  const zoomed = zoomIndoorCamera(camera, 2, 80, 30);
  expect(zoomed.scale).toBe(4);
  expect((80 - zoomed.x) / zoomed.scale).toBe((80 - camera.x) / camera.scale);
  expect((30 - zoomed.y) / zoomed.scale).toBe((30 - camera.y) / camera.scale);
  expect(zoomIndoorCamera(camera, 100).scale).toBe(8);
  expect(zoomIndoorCamera(camera, 0.01).scale).toBe(1);
});

it('rotates about the gesture centre and preserves orientation during zoom', () => {
  const camera = { x: 40, y: 20, scale: 2, rotation: 10 };
  const turned = rotateIndoorCamera(camera, 90, 20, 20);
  expect(turned.x).toBeCloseTo(20);
  expect(turned.y).toBeCloseTo(40);
  expect(turned.rotation).toBe(100);
  expect(zoomIndoorCamera(turned, 2).rotation).toBe(100);
  expect(angleDelta(179, -179)).toBe(2);
  expect(angleDelta(1080, -10)).toBe(-10);
});
