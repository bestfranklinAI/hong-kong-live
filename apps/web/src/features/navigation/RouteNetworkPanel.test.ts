// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { NetworkSegment, WalkingRoute } from '@hk/contracts';
import type { RouteNetworkState } from './use-route-network';
import { RouteNetworkPanel } from './RouteNetworkPanel';

it('offers one option per type and opens section details by pointer and keyboard instead of a repeated-record dropdown', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  const segment: NetworkSegment = {
    id: '1',
    kind: 'Subway',
    cover: 'covered',
    enabled: true,
    floorId: null,
    accessTimeId: null,
    amendedAt: null,
    paths: [
      [
        [114.16, 22.28, 2],
        [114.161, 22.281, 3],
      ],
    ],
  };
  const network: RouteNetworkState = {
    visible: true,
    category: 'connections',
    kind: 'all',
    availableKinds: [
      { value: 'Subway', label: 'Pedestrian underpasses', singular: 'Pedestrian underpass' },
    ],
    data: {
      segments: [segment, { ...segment, id: '2', kind: 'Escalator' }],
      partial: false,
      category: 'connections',
      corridorM: 50,
      fetchedAt: '2026-10-19T00:00:00Z',
      sourceUrl: 'https://example.com',
      heightDatum: 'HKPD',
    },
    loading: false,
    error: null,
    retry: vi.fn(),
    setVisible: vi.fn(),
    setKind: vi.fn(),
    setCategory: vi.fn(),
  };
  try {
    await act(async () =>
      root.render(
        createElement(RouteNetworkPanel, {
          network,
          route: { paths: segment.paths } as WalkingRoute,
        }),
      ),
    );
    expect(host.querySelectorAll('select')).toHaveLength(1);
    expect(host.querySelector('select')?.textContent).toBe('All typesPedestrian underpasses');
    expect(host.textContent).not.toContain('Inspect a connection');
    const sections = host.querySelectorAll<SVGElement>('[data-network-section]');
    expect([...sections].map((s) => s.tabIndex)).toEqual([0, -1]);
    await act(async () => sections[0].dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(host.querySelector('.network-record')?.textContent).toContain(
      'Pedestrian underpass section',
    );
    await act(async () =>
      sections[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })),
    );
    expect(host.querySelector('.network-record')?.textContent).toContain('Escalator section');
    expect([...sections].map((s) => s.tabIndex)).toEqual([-1, 0]);
    expect(host.querySelector('.network-record details')?.hasAttribute('open')).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
