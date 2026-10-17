// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { WalkingPlanner } from './WalkingPlanner';
it('allows an assumed concourse start without forcing an exit choice', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        createElement(WalkingPlanner, {
          origin: {
            name: 'Kowloon',
            lat: 22.304255,
            lng: 114.161444,
            station: { line: 'TCL', station: 'KOW' },
          },
          destination: { name: 'Park', lat: 22.31, lng: 114.17 },
          showHidden: false,
          contextView: false,
          onShowHidden: vi.fn(),
          onContextView: vi.fn(),
          onPickMap: vi.fn(),
          onIndoorMap: vi.fn(),
          onRoute: vi.fn(),
          onClose: vi.fn(),
          onStart: vi.fn(),
          onEndpointPreview: vi.fn(),
          onInspectStation: vi.fn(),
        }),
      ),
    );
    const button = (text: string) =>
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === text,
      )!;
    expect(container.textContent).toContain('assumed concourse');
    expect(button('Find walking route').disabled).toBe(false);
    expect(button('Choose entrance or floor')).toBeTruthy();
    expect(button('Use current location')).toBeTruthy();
    expect(button('Find walking route').disabled).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
