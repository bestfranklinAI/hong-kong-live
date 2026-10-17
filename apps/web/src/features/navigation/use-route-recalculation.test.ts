// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { walkingRouteSchema } from '@hk/contracts';
import fixture from '../../../../../fixtures/providers/admiralty-routing-audit-2026-09-26.json';
import { useRouteRecalculation } from './use-route-recalculation';

const trip = walkingRouteSchema.parse(fixture.routes['eal-ground']);
const fix = { lat: 22.279, lng: 114.164, accuracy: 10 };
const changed = vi.fn();
let root: Root;
let value: ReturnType<typeof useRouteRecalculation>;
function Harness({ active }: { active: boolean }) {
  value = useRouteRecalculation(active, trip, changed);
  return null;
}
const render = async (active: boolean) => {
  await act(async () => root.render(createElement(Harness, { active })));
};
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(document.body.appendChild(document.createElement('div')));
  changed.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('keeps the existing route on failure and applies a successful retry', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Provider unavailable' }), { status: 503 }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify(trip)));
  vi.stubGlobal('fetch', fetcher);
  await render(true);
  await act(async () => value.recalculate(fix));
  expect(changed).not.toHaveBeenCalled();
  expect(value.busy).toBe(false);
  expect(value.error).toBe('Provider unavailable');
  await act(async () => value.recalculate(fix));
  expect(changed).toHaveBeenCalledExactlyOnceWith(trip);
  expect(value.error).toBe('');
  expect(JSON.parse(fetcher.mock.calls[1][1].body).start).toEqual({
    lat: fix.lat,
    lng: fix.lng,
    name: 'Current location',
  });
});
it('discards a late response after guidance ends even if the transport ignores cancellation', async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  await render(true);
  let pending!: Promise<void>;
  await act(async () => {
    pending = value.recalculate(fix);
  });
  expect(value.busy).toBe(true);
  await render(false);
  expect(fetcher.mock.calls[0]).toBeDefined();
  await act(async () => {
    finish(new Response(JSON.stringify(trip)));
    await pending;
  });
  expect(changed).not.toHaveBeenCalled();
  expect(value.busy).toBe(false);
});
it('bounds a stalled update and leaves the current route available', async () => {
  vi.useFakeTimers();
  let expire!: () => void;
  const timeout = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    expect(ms).toBe(20000);
    expire = () => timeout.abort(new DOMException('Timed out', 'TimeoutError'));
    return timeout.signal;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener('abort', () => reject(options.signal!.reason), {
            once: true,
          });
        }),
    ),
  );
  await render(true);
  let pending!: Promise<void>;
  await act(async () => {
    pending = value.recalculate(fix);
  });
  await act(async () => {
    expire();
    await pending;
  });
  expect(value.error).toBe('Route update timed out. Try again.');
  expect(value.busy).toBe(false);
  expect(changed).not.toHaveBeenCalled();
});

it('keeps malformed responses out of the route and the user-facing error text', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response('<html>Unavailable</html>'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ paths: 'invalid' }))),
  );
  await render(true);
  for (let i = 0; i < 2; i++) {
    await act(async () => value.recalculate(fix));
    expect(value.error).toBe('Route update unavailable. Try again.');
    expect(changed).not.toHaveBeenCalled();
  }
});
