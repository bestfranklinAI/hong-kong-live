// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { coordinateResult, type DiscoveryResponse } from '@hk/contracts';
import { SearchResults } from './SearchResults';

const row = {
  ...coordinateResult({ lat: 22.2836, lng: 114.1644 }),
  id: 'curated:central-waterfront',
  placeId: 'central-waterfront',
  kind: 'place' as const,
  source: 'curated' as const,
  name: 'Central Waterfront',
  nameZh: '中環海濱',
  locationPrecision: 'reference' as const,
};
const response: DiscoveryResponse = {
  experimental: true,
  mode: 'fixture',
  ranking: 'model',
  unmatchedInterests: ['food'],
  results: [row],
  notices: ['Current lift operation is not verified.'],
  intent: {
    interests: ['waterfront', 'food'],
    area: '',
    mobility: 'fewer-stairs',
    unverifiedNeeds: ['open-now'],
  },
};
let root: Root, container: HTMLDivElement, client: QueryClient;
const selected = vi.fn();
const render = async (
  query = '搵海邊行下，附近食嘢，盡量少樓梯',
  selectionPurpose: 'map' | 'start' | 'end' = 'map',
) =>
  act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(SearchResults, {
          query,
          language: 'tc',
          discoveryCenter: { lat: 22.28, lng: 114.16 },
          selectionPurpose,
          onSelect: selected,
        }),
      ),
    ),
  );
const standard = {
  results: [],
  notices: [],
  catalogue: {
    sourceDate: null,
    fetchedAt: null,
    importedAt: null,
    count: 0,
    resolved: 0,
    stale: true,
  },
};
const settleCapability = async () =>
  act(async () => {
    await vi.waitFor(() =>
      expect(client.getQueryState(['discovery-evaluation-status'])?.status).toBe('success'),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  selected.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});

it('keeps the feature hidden and never sends a query for model interpretation when disabled', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(url.endsWith('/status') ? { enabled: false, experimental: true } : standard),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  await render();
  await settleCapability();
  expect(container.textContent).not.toContain('Smart search');
  expect(fetcher.mock.calls.every(([url]) => !url.endsWith('/discovery'))).toBe(true);
});

it('requires a click, labels recorded responses and unknown requirements, and hands off source identity', async () => {
  const requests: RequestInit[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit = {}) => {
      if (url.endsWith('/status'))
        return new Response(JSON.stringify({ enabled: true, experimental: true }));
      if (url.endsWith('/discovery')) {
        requests.push(options);
        return new Response(JSON.stringify(response));
      }
      return new Response(JSON.stringify(standard));
    }),
  );
  await render();
  await settleCapability();
  expect(requests).toHaveLength(0);
  await act(async () => container.querySelector<HTMLButtonElement>('.discovery-submit')!.click());
  expect(requests).toHaveLength(1);
  expect(JSON.parse(requests[0].body as string).center).toEqual({ lat: 22.28, lng: 114.16 });
  expect(container.textContent).toContain('Recorded evaluation response');
  expect(container.textContent).toContain('Not verified: current opening hours');
  expect(container.querySelector('.discovery-preferences')?.textContent).toBe(
    'WaterfrontFoodFewer stairs',
  );
  expect(container.textContent).toContain('No mapped suggestions found for: Food');
  expect(container.textContent).toContain(
    'Accessibility and current lift operation are unverified',
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>('.discovery-evaluation .search-result')!.click(),
  );
  expect(selected).toHaveBeenCalledExactlyOnceWith(row, response.intent);
});

it('cancels on a changed query and discards a late old interpretation', async () => {
  let finish!: (response: Response) => void;
  let signal!: AbortSignal;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options: RequestInit = {}) => {
      if (url.endsWith('/status'))
        return new Response(JSON.stringify({ enabled: true, experimental: true }));
      if (url.endsWith('/discovery')) {
        signal = options.signal!;
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return new Response(JSON.stringify(standard));
    }),
  );
  await render();
  await settleCapability();
  await act(async () => container.querySelector<HTMLButtonElement>('.discovery-submit')!.click());
  await render('Find a park');
  expect(signal.aborted).toBe(true);
  await act(async () => finish(new Response(JSON.stringify(response))));
  expect(container.textContent).not.toContain('Recorded evaluation response');
  expect(selected).not.toHaveBeenCalled();
});

it.each([
  ['start', 'Use as starting point'],
  ['end', 'Use as destination'],
] as const)(
  'labels the %s handoff without automatically selecting a place',
  async (purpose, label) => {
    vi.stubGlobal(
      'fetch',
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith('/status')
              ? { enabled: true, experimental: true }
              : url.endsWith('/discovery')
                ? response
                : standard,
          ),
        ),
    );
    await render(undefined, purpose);
    await settleCapability();
    await act(async () => container.querySelector<HTMLButtonElement>('.discovery-submit')!.click());
    expect(container.querySelector('.discovery-selection')?.textContent).toContain(label);
    expect(selected).not.toHaveBeenCalled();
  },
);

it('retains source suggestions on a failed retry without exposing raw network errors', async () => {
  let attempts = 0;
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/status'))
      return new Response(JSON.stringify({ enabled: true, experimental: true }));
    if (url.endsWith('/discovery')) {
      if (++attempts > 1) throw new Error('Private upstream failure details');
      return new Response(JSON.stringify(response));
    }
    return new Response(JSON.stringify(standard));
  });
  await render();
  await settleCapability();
  const interpret = () =>
    act(async () => container.querySelector<HTMLButtonElement>('.discovery-submit')!.click());
  await interpret();
  await interpret();
  expect(container.textContent).toContain('Experimental search is unavailable');
  expect(container.textContent).toContain('Previous suggestions for this request remain available');
  expect(container.textContent).not.toContain('Private upstream');
  await act(async () =>
    container.querySelector<HTMLButtonElement>('.discovery-evaluation .search-result')!.click(),
  );
  expect(selected).toHaveBeenCalledExactlyOnceWith(row, response.intent);
});

it('retains suggestions on cancellation and ignores a late cancelled retry during a newer request', async () => {
  const pending: { resolve: (response: Response) => void; signal: AbortSignal }[] = [];
  let attempts = 0;
  vi.stubGlobal('fetch', async (url: string, options: RequestInit = {}) => {
    if (url.endsWith('/status'))
      return new Response(JSON.stringify({ enabled: true, experimental: true }));
    if (url.endsWith('/discovery')) {
      if (++attempts === 1) return new Response(JSON.stringify(response));
      return new Promise<Response>((resolve) => pending.push({ resolve, signal: options.signal! }));
    }
    return new Response(JSON.stringify(standard));
  });
  await render();
  await settleCapability();
  const interpret = () =>
    act(async () => container.querySelector<HTMLButtonElement>('.discovery-submit')!.click());
  await interpret();
  await interpret();
  expect(container.querySelector('.discovery-evaluation .search-result')).not.toBeNull();
  await act(async () =>
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Cancel interpretation')!
      .click(),
  );
  expect(pending[0].signal.aborted).toBe(true);
  expect(container.textContent).toContain('Interpretation cancelled');
  await interpret();
  await act(async () =>
    pending[0].resolve(new Response(JSON.stringify({ ...response, results: [] }))),
  );
  expect(container.querySelector<HTMLButtonElement>('.discovery-submit')!.disabled).toBe(true);
  expect(container.querySelector('.discovery-evaluation .search-result')).not.toBeNull();
  await act(async () =>
    pending[1].resolve(
      new Response(JSON.stringify({ ...response, results: [], ranking: 'not-run' })),
    ),
  );
  expect(container.querySelector<HTMLButtonElement>('.discovery-submit')!.disabled).toBe(false);
  expect(container.textContent).toContain('No source suggestions were selected');
  expect(selected).not.toHaveBeenCalled();
});
