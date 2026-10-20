// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { NetworkSegment, WalkingRoute } from '@hk/contracts';
import { useRouteNetwork } from './use-route-network';

it('fetches only on request, aborts hidden work, and clears visibility for a new route', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const signals: AbortSignal[] = [];
  const fetcher = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal!;
        signals.push(signal);
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        );
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement('div');
  const root = createRoot(host);
  let state!: ReturnType<typeof useRouteNetwork>;
  function Probe({ route }: { route: WalkingRoute }) {
    state = useRouteNetwork(route);
    return null;
  }
  const route = {
    paths: [
      [
        [114.16, 22.28, 0],
        [114.17, 22.28, 0],
      ],
    ],
  } as WalkingRoute;
  const render = (route: WalkingRoute) =>
    act(async () =>
      root.render(createElement(QueryClientProvider, { client }, createElement(Probe, { route }))),
    );
  try {
    await render(route);
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => state.setVisible(true));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(signals[0].aborted).toBe(false);
    await act(async () => state.setVisible(false));
    expect(signals[0].aborted).toBe(true);
    await act(async () => state.setVisible(true));
    expect(fetcher).toHaveBeenCalledTimes(2);
    await render({
      ...route,
      paths: [
        [
          [114.18, 22.28, 0],
          [114.19, 22.28, 0],
        ],
      ],
    });
    expect(signals[1].aborted).toBe(true);
    expect(state.visible).toBe(false);
    expect(state.data).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});
it('filters the shared map data by type without requesting another publication', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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
  const fetcher = vi.fn(async () =>
    Response.json({
      segments: [segment, { ...segment, id: '2', kind: 'Escalator' }],
      category: 'connections',
      corridorM: 50,
      partial: false,
      fetchedAt: '2026-10-19T00:00:00Z',
      sourceUrl: 'https://example.com',
      heightDatum: 'HKPD',
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(document.createElement('div'));
  let state!: ReturnType<typeof useRouteNetwork>;
  const route = { paths: segment.paths } as WalkingRoute;
  function Probe() {
    state = useRouteNetwork(route);
    return null;
  }
  try {
    await act(async () =>
      root.render(createElement(QueryClientProvider, { client }, createElement(Probe))),
    );
    await act(async () => state.setVisible(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(state.data?.segments).toHaveLength(2);
    await act(async () => state.setKind('Subway'));
    expect(state.data?.segments.map((s) => s.kind)).toEqual(['Subway']);
    expect(state.availableKinds.map((row) => row.value)).toEqual(['Subway', 'Escalator']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});
