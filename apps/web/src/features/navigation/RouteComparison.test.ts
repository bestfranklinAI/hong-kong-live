// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { walkingRouteSchema, type WalkingRoute } from '@hk/contracts';
import sample from '../../../../../fixtures/providers/kowloon-jordan-route-2026-10-17.json';
import { RouteComparison } from './RouteComparison';
import { useRouteComparison } from './use-route-comparison';

const original = walkingRouteSchema.parse(sample.route);
let root: Root;
let container: HTMLDivElement;
let value: ReturnType<typeof useRouteComparison>;
let selected: WalkingRoute;
function Harness() {
  value = useRouteComparison(original);
  const [route, setRoute] = useState(original);
  selected = route;
  return createElement(RouteComparison, { comparison: value, selected: route, onSelect: setRoute });
}
const response = (profile: 'shortest' | 'barrier-free') =>
  new Response(
    JSON.stringify({
      ...original,
      request: { ...original.request, profile },
    }),
  );
const button = (text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.body.appendChild(document.createElement('div'));
  root = createRoot(container);
  await act(async () => root.render(createElement(Harness)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps the selected result, loads only missing profiles, retries failures, and switches instantly', async () => {
  const calls: Array<{ body: typeof original.request }> = [];
  let barrierAttempts = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      calls.push({ body });
      if (body.profile === 'barrier-free' && ++barrierAttempts === 1)
        return new Response(JSON.stringify({ error: 'Source temporarily unavailable' }), {
          status: 502,
        });
      return response(body.profile);
    }),
  );
  expect(calls).toHaveLength(0);
  await act(async () => {
    await value.toggle();
  });
  expect(calls.map((call) => call.body.profile).sort()).toEqual(['barrier-free', 'shortest']);
  expect(
    calls.every(
      (call) => JSON.stringify(call.body.start) === JSON.stringify(original.request.start),
    ),
  ).toBe(true);
  expect(
    calls.every((call) => JSON.stringify(call.body.end) === JSON.stringify(original.request.end)),
  ).toBe(true);
  expect(selected).toEqual(original);
  expect(container.textContent).toContain('Source temporarily unavailable');
  expect(container.textContent).toContain('Same mapped path as Recommended');
  await act(async () => button('Use Shortest').click());
  expect(selected.request.profile).toBe('shortest');
  expect(calls).toHaveLength(2);
  await act(async () => {
    await value.retry('barrier-free');
  });
  expect(calls).toHaveLength(3);
  // The captured route mentions stairs; a profile label cannot erase that evidence.
  expect(container.textContent).toContain('This Barrier-free result mentions stairs or escalators');
  await act(async () => button('Use Barrier-free').click());
  expect(selected.request.profile).toBe('barrier-free');
  await act(async () => {
    await value.toggle();
  });
  await act(async () => {
    await value.toggle();
  });
  expect(calls).toHaveLength(3);
});

it('discards late results after endpoints change, even when transport ignores cancellation', async () => {
  const finishes: Array<() => void> = [];
  const signals: AbortSignal[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((resolve) => {
          signals.push(options.signal!);
          const body = JSON.parse(options.body as string);
          finishes.push(() => resolve(response(body.profile)));
        }),
    ),
  );
  let pending!: Promise<PromiseSettledResult<void>[]>;
  await act(async () => {
    pending = value.toggle()!;
  });
  expect(signals).toHaveLength(2);
  const replacement = {
    ...original,
    request: {
      ...original.request,
      end: { ...original.request.end, name: 'A different destination', lat: 22.31 },
    },
  };
  await act(async () => value.reset(replacement));
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  await act(async () => {
    finishes.forEach((finish) => finish());
    await pending;
  });
  expect(value.request?.end.name).toBe('A different destination');
  expect(Object.keys(value.choices)).toEqual(['recommended']);
  expect(value.expanded).toBe(false);
});

it('rejects mismatched profiles and malformed responses while retaining usable routes', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(original)))
    .mockResolvedValueOnce(new Response('<html>Provider failure</html>'));
  vi.stubGlobal('fetch', fetcher);
  await act(async () => {
    await value.toggle();
  });
  expect(value.choices.shortest?.status).toBe('error');
  expect(value.choices['barrier-free']?.status).toBe('error');
  expect(container.textContent).toContain('does not match the requested profile or language');
  expect(container.textContent).not.toContain('Provider failure');
  expect(value.choices.recommended?.status).toBe('ready');
  expect(selected).toEqual(original);
});

it('bounds stalled profile requests and supports a subsequent retry', async () => {
  const deadlines: AbortController[] = [];
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    expect(ms).toBe(45000);
    const deadline = new AbortController();
    deadlines.push(deadline);
    return deadline.signal;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal!.addEventListener('abort', () => reject(options.signal!.reason), {
            once: true,
          });
        }),
    ),
  );
  let pending!: Promise<PromiseSettledResult<void>[]>;
  await act(async () => {
    pending = value.toggle()!;
  });
  await act(async () => {
    deadlines.forEach((deadline) => deadline.abort(new DOMException('Timed out', 'TimeoutError')));
    await pending;
  });
  expect(value.choices.shortest).toEqual({
    status: 'error',
    error: 'Route request timed out. Try again.',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response('shortest')),
  );
  await act(async () => {
    await value.retry('shortest');
  });
  expect(value.choices.shortest?.status).toBe('ready');
});

it('aborts profile requests when the planner unmounts', async () => {
  const signals: AbortSignal[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, options: RequestInit) => {
      signals.push(options.signal!);
      return new Promise<Response>(() => {});
    }),
  );
  await act(async () => {
    void value.toggle();
  });
  expect(signals).toHaveLength(2);
  await act(async () => root.unmount());
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  root = createRoot(container);
});
