import { afterEach, expect, it, vi } from 'vitest';
import { coordinateResult, discoveryRequestSchema, type DiscoveryIntent } from '@hk/contracts';
import { DiscoverySearch, groundedRanking, type DiscoveryAssistant } from './discovery';
import { retrieveDiscoveryCandidates, modelCandidates } from './discovery-retrieval';
import { emptyRepository } from './repository';
import { createApp } from '../app';

const intent: DiscoveryIntent = {
  interests: ['waterfront', 'food'],
  area: '',
  mobility: 'fewer-stairs',
  unverifiedNeeds: [],
};
const request = {
  query: '搵海邊行下，附近食嘢，盡量少樓梯',
  language: 'tc' as const,
  center: { lat: 22.2836, lng: 114.1644 },
};
const pool = () => retrieveDiscoveryCandidates(intent, request);
const assistant = (): DiscoveryAssistant => ({
  interpret: vi.fn(async () => structuredClone(intent)),
  rank: vi.fn<DiscoveryAssistant['rank']>(async ({ candidates }) => ({
    candidateIds: candidates.map((row) => row.id).slice(0, 8),
  })),
});
afterEach(() => vi.restoreAllMocks());

it('ranks only retrieved IDs and preserves canonical coordinates and provenance for map handoff', async () => {
  const model = assistant();
  const result = await new DiscoverySearch(model, pool).search(
    request,
    new AbortController().signal,
  );
  expect(result.ranking).toBe('model');
  expect(result.experimental).toBe(true);
  expect(result.results.length).toBeGreaterThan(0);
  expect(result.results[0]).toEqual(pool()[0].result);
  expect(result.notices.join(' ')).toContain('No mapped food candidates');
  expect(result.unmatchedInterests).toEqual(['food']);
  expect(result.notices.join(' ')).toContain('not a walking connection');
  expect(result.notices.join(' ')).toContain(
    'Compare the official Recommended, Shortest and Barrier-free routes',
  );
  for (const candidate of modelCandidates(pool())) {
    expect(candidate).not.toHaveProperty('location');
    expect(candidate).not.toHaveProperty('coordinates');
    expect(candidate).not.toHaveProperty('route');
  }
  expect(model.interpret).toHaveBeenCalledWith(
    { query: request.query, language: request.language },
    expect.any(AbortSignal),
  );
});

it.each([
  { candidateIds: ['made-up-place'] },
  { candidateIds: [pool()[0].result.id, pool()[0].result.id] },
  { candidateIds: [pool()[0].result.id], coordinates: { lat: 22.3, lng: 114.1 } },
  { candidateIds: [pool()[0].result.id], accessibility: 'Guaranteed step-free' },
])(
  'rejects unsupported ranking output and explicitly labels the retrieval fallback: %j',
  async (output) => {
    expect(() => groundedRanking(output, pool())).toThrow();
    const model = assistant();
    model.rank = vi.fn(async () => output);
    const result = await new DiscoverySearch(model, pool).search(
      request,
      new AbortController().signal,
    );
    expect(result.ranking).toBe('retrieval-fallback');
    expect(result.results).toEqual(
      pool()
        .slice(0, 8)
        .map((row) => row.result),
    );
    expect(result.notices.join(' ')).toContain('ranking was unavailable or invalid');
  },
);

it('distinguishes model abstention from missing source coverage', async () => {
  const model = assistant();
  model.rank = vi.fn(async () => ({ candidateIds: [] }));
  const result = await new DiscoverySearch(model, pool).search(
    request,
    new AbortController().signal,
  );
  expect(result.results).toEqual([]);
  expect(result.alternatives?.map((row) => row.id)).toEqual(
    pool()
      .slice(0, 3)
      .map((row) => row.result.id),
  );
  expect(result.coverage?.candidateCount).toBe(pool().length);
  expect(result.unmatchedInterests).toEqual(['food']);
  expect(result.notices.join(' ')).toContain('assistant did not select a source candidate');
  expect(result.notices.join(' ')).not.toContain('No grounded candidates matched');
});

it('requires an explicit wider radius and accepts bilingual area aliases', () => {
  const row = {
    ...coordinateResult({ lat: 22.32, lng: request.center.lng }),
    name: 'Central test park',
    district: 'Central & Western',
    facility: {
      category: 'park' as const,
      dataset: 'test',
      sourceUrl: 'https://www.lcsd.gov.hk',
      fetchedAt: new Date().toISOString(),
      hours: '',
      hoursZh: '',
      details: '',
      detailsZh: '',
      locationNote: '',
      locationNoteZh: '',
      phone: '',
    },
  };
  const preference = { ...intent, interests: ['park' as const], area: '中環' };
  expect(
    retrieveDiscoveryCandidates(preference, request, emptyRepository, [row]).some(
      (candidate) => candidate.result.id === row.id,
    ),
  ).toBe(false);
  expect(
    retrieveDiscoveryCandidates(preference, { ...request, radiusM: 5000 }, emptyRepository, [
      row,
    ]).some((candidate) => candidate.result.id === row.id),
  ).toBe(true);
  expect(discoveryRequestSchema.safeParse({ ...request, radiusM: 999999 }).success).toBe(false);
});

it('reserves candidates for different interests when one nearby layer is dense', () => {
  const facilities = Array.from({ length: 30 }, (_, i) => ({
    ...coordinateResult(request.center),
    id: `refill:${i}`,
    facility: {
      category: 'refill' as const,
      dataset: 'test',
      sourceUrl: 'https://www.lcsd.gov.hk',
      fetchedAt: new Date().toISOString(),
      hours: '',
      hoursZh: '',
      details: '',
      detailsZh: '',
      locationNote: '',
      locationNoteZh: '',
      phone: '',
    },
  }));
  const rows = retrieveDiscoveryCandidates(
    { ...intent, interests: ['refill', 'waterfront'] },
    request,
    emptyRepository,
    facilities,
  );
  expect(rows).toHaveLength(24);
  expect(rows.some((candidate) => candidate.interests.includes('waterfront'))).toBe(true);
});

it('prefers an official facility over the same curated place while retaining distinct installations', () => {
  const preference = { ...intent, interests: ['park' as const] };
  const original = retrieveDiscoveryCandidates(preference, request).find(
    (row) => row.result.name === 'Tamar Park',
  )!.result;
  const official = {
    ...original,
    id: 'facility:tamar',
    source: 'LCSD' as const,
    facility: {
      category: 'park' as const,
      dataset: 'test',
      sourceUrl: 'https://www.lcsd.gov.hk',
      fetchedAt: new Date().toISOString(),
      hours: '',
      hoursZh: '',
      details: '',
      detailsZh: '',
      locationNote: '',
      locationNoteZh: '',
      phone: '',
    },
  };
  const rows = retrieveDiscoveryCandidates(preference, request, emptyRepository, [official]);
  expect(rows.some((row) => row.result.id === official.id)).toBe(true);
  expect(rows.some((row) => row.result.id === original.id)).toBe(false);
});

it('reports restaurant map coverage independently from model confidence', async () => {
  const result = await new DiscoverySearch(assistant(), pool, 'live', () => ({
    count: 17270,
    resolved: 2,
    sourceDate: null,
    fetchedAt: null,
    importedAt: null,
    stale: true,
  })).search(request, new AbortController().signal);
  expect(result.coverage).toMatchObject({
    restaurantsTotal: 17270,
    restaurantsMapped: 2,
    radiusM: 2000,
    referenceProvided: true,
  });
});

it('rejects invented facts in interpretation before retrieval or ranking', async () => {
  const model = assistant();
  model.interpret = vi.fn(async () => ({ ...intent, floor: 2, workingLift: true }));
  const retrieve = vi.fn(pool);
  await expect(
    new DiscoverySearch(model, retrieve).search(request, new AbortController().signal),
  ).rejects.toThrow();
  expect(retrieve).not.toHaveBeenCalled();
  expect(model.rank).not.toHaveBeenCalled();
});

it('keeps unsupported requirements explicit and skips ranking when no candidates exist', async () => {
  const model = assistant();
  model.interpret = vi.fn(async () => ({
    ...intent,
    interests: [],
    unverifiedNeeds: ['open-now', 'working-lifts', 'indoor-position', 'covered-walk'],
  }));
  const result = await new DiscoverySearch(model, () => []).search(
    request,
    new AbortController().signal,
  );
  expect(result.ranking).toBe('not-run');
  expect(result.results).toEqual([]);
  expect(result.notices.join(' ')).toContain('Current opening hours are not verified');
  expect(result.notices.join(' ')).toContain('Current lift operation is not verified');
  expect(result.notices.join(' ')).toContain('floors cannot be identified');
  expect(model.rank).not.toHaveBeenCalled();
});

it('uses known restaurant coordinates only and never geocodes an unresolved restaurant', () => {
  const row = {
    ...coordinateResult(request.center),
    id: 'fehd:1',
    name: 'Test food record',
    kind: 'restaurant' as const,
    source: 'FEHD' as const,
    locationPrecision: 'address' as const,
  };
  const repository = {
    ...emptyRepository,
    nearby: vi.fn(() => [row, { ...row, id: 'fehd:2', location: null }]),
  };
  const rows = retrieveDiscoveryCandidates({ ...intent, interests: ['food'] }, request, repository);
  expect(rows.map((candidate) => candidate.result.id)).toEqual(['fehd:1']);
  expect(repository.nearby).toHaveBeenCalledWith(request.center.lat, request.center.lng, 100);
  expect(discoveryRequestSchema.safeParse({ ...request, center: { lat: 0, lng: 0 } }).success).toBe(
    false,
  );
});

it('bounds a stalled adapter even when it ignores cancellation', async () => {
  const deadline = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    expect(ms).toBe(10000);
    return deadline.signal;
  });
  const model = assistant();
  model.interpret = vi.fn(() => new Promise(() => {}));
  const pending = new DiscoverySearch(model, pool).search(request, new AbortController().signal);
  const assertion = expect(pending).rejects.toThrow('Timed out');
  await Promise.resolve();
  expect(model.interpret).toHaveBeenCalledOnce();
  deadline.abort(new DOMException('Timed out', 'TimeoutError'));
  await assertion;
  expect(model.rank).not.toHaveBeenCalled();
});

const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
it('keeps evaluation disabled by default and isolates fixture mode from model calls', async () => {
  const model = assistant();
  for (const options of [
    { mode: 'live' as const },
    { mode: 'fixture' as const, enableDiscoveryEvaluation: true, discoveryAssistant: model },
  ]) {
    const app = createApp(options);
    expect(await (await app.request('/api/v1/search/discovery/status')).json()).toEqual({
      experimental: true,
      enabled: false,
    });
    const response = await app.request('/api/v1/search/discovery', post(request));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
  expect(model.interpret).not.toHaveBeenCalled();
});

it('validates HTTP requests and caps the explicitly enabled evaluation at ten per minute', async () => {
  const model = assistant();
  const app = createApp({
    mode: 'live',
    enableDiscoveryEvaluation: true,
    discoveryAssistant: model,
  });
  expect(
    (await app.request('/api/v1/search/discovery', post({ ...request, query: 'x'.repeat(501) })))
      .status,
  ).toBe(400);
  expect(
    (await app.request('/api/v1/search/discovery', post({ ...request, query: 'x'.repeat(5000) })))
      .status,
  ).toBe(413);
  expect(model.interpret).not.toHaveBeenCalled();
  for (let i = 0; i < 10; i++)
    expect((await app.request('/api/v1/search/discovery', post(request))).status).toBe(200);
  expect((await app.request('/api/v1/search/discovery', post(request))).status).toBe(429);
});

it('allows two pending evaluations and rejects excess concurrency', async () => {
  const finishes: Array<() => void> = [];
  const model = assistant();
  model.interpret = vi.fn(
    () =>
      new Promise((resolve) => {
        finishes.push(() => resolve(intent));
      }),
  );
  const app = createApp({
    mode: 'live',
    enableDiscoveryEvaluation: true,
    discoveryAssistant: model,
  });
  const first = app.request('/api/v1/search/discovery', post(request));
  const second = app.request('/api/v1/search/discovery', post(request));
  await vi.waitFor(() => expect(finishes).toHaveLength(2));
  expect((await app.request('/api/v1/search/discovery', post(request))).status).toBe(429);
  finishes.forEach((finish) => finish());
  expect((await first).status).toBe(200);
  expect((await second).status).toBe(200);
});
