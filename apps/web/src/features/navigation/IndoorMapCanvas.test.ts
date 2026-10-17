// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { IndoorMapCanvas } from './IndoorMapCanvas';
it('handles a two-pointer pinch, publishes the settled zoom, and resets the camera', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const scales: number[] = [];
  try {
    await act(async () =>
      root.render(
        createElement(IndoorMapCanvas, {
          children: (scale) => {
            scales.push(scale);
            return null;
          },
        }),
      ),
    );
    const canvas = container.querySelector<HTMLElement>('.indoor-canvas')!;
    canvas.setPointerCapture = vi.fn();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      width: 320,
      height: 400,
      left: 0,
      top: 0,
    } as DOMRect);
    const pointer = (type: string, pointerId: number, clientX: number, clientY: number) =>
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId,
          clientX,
          clientY,
          button: 0,
          pointerType: 'touch',
        }),
      );
    await act(async () => {
      pointer('pointerdown', 1, 100, 200);
      pointer('pointerdown', 2, 200, 200);
      pointer('pointermove', 2, 300, 200);
    });
    expect(container.querySelector<HTMLElement>('.indoor-canvas-world')!.style.transform).toContain(
      'scale(2)',
    );
    expect(scales.at(-1)).toBe(1); // Gestures don't route every frame through React.
    await act(async () => {
      pointer('pointermove', 2, 100, 400);
    });
    expect(container.querySelector<HTMLElement>('.indoor-canvas-world')!.style.transform).toContain(
      'rotate(90deg)',
    );
    await act(async () => {
      pointer('pointerup', 2, 300, 200);
      pointer('pointerup', 1, 100, 200);
    });
    expect(scales.at(-1)).toBe(2);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[aria-label="Fit indoor map"]')!.click(),
    );
    expect(scales.at(-1)).toBe(1);
    expect(container.querySelector<HTMLElement>('.indoor-canvas-world')!.style.transform).toContain(
      'translate(0px, 0px)',
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
