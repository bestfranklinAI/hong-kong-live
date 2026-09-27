import { expect, it, vi } from 'vitest';
import { createApp } from './app';
import sample from '../../../fixtures/providers/landsd-route-swt-2026-09-26.json';
const body = {
  start: { name: 'Concourse', lng: 114.19133, lat: 22.32587 },
  end: { name: 'Platform', lng: 114.19156, lat: 22.32593 },
  profile: 'barrier-free',
};
const post = (data: unknown) =>
  new Request('http://localhost/api/v1/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
it('returns validated directions with no-store and rejects invalid requests before fetching', async () => {
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('retrieveTravelModes')
            ? { supportedTravelModes: [{ name: 'Barrier Free Path', id: '2' }] }
            : sample,
        ),
      ),
  );
  const app = createApp({ fetcher });
  expect(
    (await app.request(post({ ...body, start: { lat: 0, lng: 0, name: 'outside' } }))).status,
  ).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  const response = await app.request(post(body));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect((await response.json()).steps.length).toBeGreaterThan(1);
});
it('fixture mode never calls live routing; oversize bodies are rejected', async () => {
  const fetcher = vi.fn();
  const app = createApp({ fetcher, mode: 'fixture' });
  expect((await app.request(post(body))).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await app.request(post({ text: 'x'.repeat(9000) }))).status).toBe(413);
});
it('validates indoor station identifiers before provider I/O', async () => {
  const fetcher = vi.fn();
  const app = createApp({ fetcher });
  expect(
    (await app.request('http://localhost/api/v1/routes/indoor/stations/not-a-uuid/points')).status,
  ).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  const fixture = createApp({ fetcher, mode: 'fixture' });
  expect((await fixture.request('http://localhost/api/v1/routes/indoor/stations')).status).toBe(
    503,
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('validates floor requests and keeps unavailable geometry explicit', async () => {
  const fetcher = vi.fn(async () => new Response('{}'));
  const app = createApp({ fetcher });
  expect(
    (await app.request('http://localhost/api/v1/routes/indoor/stations/invalid/floors')).status,
  ).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    (
      await app.request(
        'http://localhost/api/v1/routes/indoor/stations/d47477e8-81bb-4400-943a-e2541261bf4b/floors',
      )
    ).status,
  ).toBe(502);
});

it('rejects invalid layout identifiers and fixture mode before fetching', async () => {
  const fetcher = vi.fn();
  const app = createApp({ fetcher });
  expect(
    (await app.request('http://localhost/api/v1/routes/indoor/stations/invalid/layout')).status,
  ).toBe(400);
  const fixture = createApp({ fetcher, mode: 'fixture' });
  expect(
    (
      await fixture.request(
        'http://localhost/api/v1/routes/indoor/stations/d47477e8-81bb-4400-943a-e2541261bf4b/layout',
      )
    ).status,
  ).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
