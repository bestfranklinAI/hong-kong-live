import { expect, it, vi } from 'vitest';
import { allowedMapUrl, coordinatesFromMapUrl, resolveGoogleMapsLink } from './map-links';

const direct = 'https://www.google.com/maps/search/?api=1&query=22.3011308%2C114.1833802';
it('extracts explicit coordinates without making a network request', async () => {
  const fetcher = vi.fn();
  const result = await resolveGoogleMapsLink(direct, fetcher);
  expect(result.result?.location).toEqual({ lat: 22.3011308, lng: 114.1833802 });
  expect(result.coordinateKind).toBe('place');
  expect(fetcher).not.toHaveBeenCalled();
});
it('prefers place coordinates over camera coordinates and labels camera-only links', () => {
  const result = coordinatesFromMapUrl(
    new URL('https://www.google.com/maps/place/Test/@22.4,114.2,14z/data=!4m2!3d22.3!4d114.18'),
  );
  expect(result.result?.location).toEqual({ lat: 22.3, lng: 114.18 });
  expect(result.coordinateKind).toBe('place');
  expect(
    coordinatesFromMapUrl(new URL('https://www.google.com/maps/@22.4,114.2,14z')).coordinateKind,
  ).toBe('map-centre');
  expect(coordinatesFromMapUrl(new URL(direct + '&query_place_id=ChIJtest')).coordinateKind).toBe(
    'map-centre',
  );
});
it('does not guess coordinates for routes, name-only links, multiple points or out-of-area links', () => {
  for (const url of [
    'https://www.google.com/maps/dir/22.3,114.1/22.4,114.2/@22.3,114.1,12z',
    'https://www.google.com/maps/?q=Bakehouse&ll=22.3,114.1',
    'https://www.google.com/maps/?cid=123',
    'https://www.google.com/maps/place/Test/data=!3d22.3!4d114.1!3d22.4!4d114.2',
    'https://www.google.com/maps/?q=51.5,-0.12',
    'https://www.google.com/maps/?q=99,114.2',
  ])
    expect(coordinatesFromMapUrl(new URL(url)).result).toBeNull();
});
it('rejects unsupported hosts, schemes, credentials, ports and non-map paths', () => {
  for (const url of [
    'http://maps.app.goo.gl/test',
    'https://127.0.0.1/maps',
    'https://www.google.com.evil.example/maps',
    'https://evil.google.com/maps',
    'https://user:password@www.google.com/maps',
    'https://www.google.com:8443/maps',
    'https://www.google.com/url?q=https://example.com',
    'https://goo.gl/notmaps',
    'https://maps.app.goo.gl/a/b',
    'https://maps.app.goo.gl\\@evil.example/test',
  ])
    expect(() => allowedMapUrl(url)).toThrow();
});
it('follows bounded manual redirects and cancels bodies without reading them', async () => {
  const cancel = vi.fn();
  const fetcher = vi.fn(
    async () =>
      new Response(new ReadableStream({ cancel }), { status: 302, headers: { location: direct } }),
  );
  const result = await resolveGoogleMapsLink('https://maps.app.goo.gl/example', fetcher);
  expect(result.result?.location?.lat).toBe(22.3011308);
  expect(fetcher.mock.calls).toHaveLength(1);
  expect(cancel).toHaveBeenCalledOnce();
});
it('never follows a redirect to an arbitrary host or local service', async () => {
  for (const target of [
    'http://127.0.0.1:8787/api',
    'https://example.com/maps',
    'https://www.google.com/url?q=x',
  ]) {
    const fetcher = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: target } }),
    );
    await expect(
      resolveGoogleMapsLink('https://maps.app.goo.gl/example', fetcher),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
it('stops loops, missing redirects, HTML landing pages and upstream failures', async () => {
  const loop = vi.fn(
    async () => new Response(null, { status: 302, headers: { location: '/example' } }),
  );
  expect((await resolveGoogleMapsLink('https://maps.app.goo.gl/example', loop)).result).toBeNull();
  expect(loop).toHaveBeenCalledTimes(1);
  for (const response of [
    new Response(null, { status: 302 }),
    new Response('HTML'),
    new Response(null, { status: 429 }),
  ]) {
    expect(
      (await resolveGoogleMapsLink('https://maps.app.goo.gl/example', async () => response)).result,
    ).toBeNull();
  }
  await expect(
    resolveGoogleMapsLink('https://maps.app.goo.gl/example', async () => {
      throw new Error('timeout');
    }),
  ).rejects.toThrow();
});
