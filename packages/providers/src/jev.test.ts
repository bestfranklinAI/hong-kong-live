import { afterEach, expect, it, vi } from 'vitest';
import { JevClient, choice, noul, score } from './jev';
import type { Fetcher } from './http';

const request = {
  state: { query: 'Find a park' },
  questions: {
    wanted: noul('Park requested?'),
    kind: choice('Which?', { park: null, food: null }),
    fit: score('How relevant?', ['unrelated', 'relevant', 'strong']),
  },
};
const response = () => ({
  model: 'jev-test-double',
  usage: { input_tokens: 20, output_tokens: null },
  answers: {
    wanted: { type: 'noul', noul: 0.9 },
    kind: {
      type: 'choice',
      choice: 'park',
      confidence: 0.9,
      probabilities: { park: 0.9, food: 0.1 },
    },
    fit: { type: 'score', score: 1.5, confidence: 0.8, probabilities: { 0: 0, 1: 0.5, 2: 0.5 } },
  },
});
afterEach(() => vi.unstubAllEnvs());

it.each([
  { score: 1.97, probabilities: { 0: 0, 1: 0.17, 2: 0.68, 3: 0.15 } },
  { score: 1.51, probabilities: { 0: 0.02, 1: 0.49, 2: 0.46, 3: 0.03 } },
  { score: 2, probabilities: { 0: 0, 1: 0.01, 2: 0.97, 3: 0.01 } },
])('accepts independently rounded live score/probability values: %j', async (answer) => {
  const client = new JevClient({
    apiKey: 'unit-test-key',
    fetcher: async () =>
      Response.json({
        model: 'jev-test-double',
        usage: {},
        answers: { fit: { type: 'score', confidence: 0.68, ...answer } },
      }),
  });
  await expect(
    client.evaluate(
      {
        state: 'test',
        questions: { fit: score('Relevance?', ['none', 'weak', 'relevant', 'strong']) },
      },
      new AbortController().signal,
    ),
  ).resolves.toMatchObject({ answers: { fit: answer } });
});

it('rejects a score outside every distribution compatible with rounding', async () => {
  const client = new JevClient({
    apiKey: 'unit-test-key',
    fetcher: async () =>
      Response.json({
        model: 'jev-test-double',
        usage: {},
        answers: {
          fit: {
            type: 'score',
            confidence: 0.68,
            score: 2.1,
            probabilities: { 0: 0, 1: 0.17, 2: 0.68, 3: 0.15 },
          },
        },
      }),
  });
  await expect(
    client.evaluate(
      {
        state: 'test',
        questions: { fit: score('Relevance?', ['none', 'weak', 'relevant', 'strong']) },
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow('invalid typed answers');
});

it('uses the official typed endpoint, fixed credential destination and configured model with bounded SDK options', async () => {
  vi.stubEnv('TYPESAFE_BASE_URL', 'https://unexpected.example');
  vi.stubEnv('TYPESAFE_LOG_LEVEL', 'debug');
  const fetcher = vi.fn<Fetcher>(async () => Response.json(response()));
  const client = new JevClient({ apiKey: 'unit-test-key', model: 'jev-latest', fetcher });
  await expect(client.evaluate(request, new AbortController().signal)).resolves.toEqual(response());
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('https://api.typesafe.ai/v1/systemone');
  expect(options?.method).toBe('POST');
  expect(options?.redirect).toBe('error');
  expect(new Headers(options?.headers).get('authorization')).toBe('Bearer unit-test-key');
  expect(new Headers(options?.headers).get('content-encoding')).toBeNull();
  expect(JSON.parse(options?.body as string)).toEqual({ ...request, model: 'jev-latest' });
  expect(client.metrics()).toEqual({
    attemptedRequests: 1,
    successfulRequests: 1,
    requestedModel: 'jev-latest',
    observedModels: ['jev-test-double'],
    inputTokens: 20,
    outputTokens: null,
  });
});

it.each([
  [
    'missing answers',
    (body: ReturnType<typeof response>) => {
      delete (body.answers as Partial<typeof body.answers>).wanted;
    },
  ],
  [
    'unknown answers',
    (body: ReturnType<typeof response>) => {
      Object.assign(body.answers, { extra: { type: 'noul', noul: 1 } });
    },
  ],
  [
    'out of range Noul',
    (body: ReturnType<typeof response>) => {
      body.answers.wanted.noul = 1.1;
    },
  ],
  [
    'unknown choice',
    (body: ReturnType<typeof response>) => {
      body.answers.kind.choice = 'invented';
    },
  ],
  [
    'unknown probability key',
    (body: ReturnType<typeof response>) => {
      Object.assign(body.answers.kind.probabilities, { invented: 0 });
    },
  ],
  [
    'unnormalized probabilities',
    (body: ReturnType<typeof response>) => {
      body.answers.kind.probabilities.park = 0.1;
    },
  ],
  [
    'out of range confidence',
    (body: ReturnType<typeof response>) => {
      body.answers.kind.confidence = -0.1;
    },
  ],
  [
    'inconsistent score',
    (body: ReturnType<typeof response>) => {
      body.answers.fit.score = 2;
    },
  ],
  [
    'wrong answer type',
    (body: ReturnType<typeof response>) => {
      Object.assign(body.answers.wanted, { type: 'choice' });
    },
  ],
])('rejects %s before accepting a provider decision', async (_, change) => {
  const body = response();
  change(body);
  const client = new JevClient({
    apiKey: 'unit-test-key',
    fetcher: async () => Response.json(body),
  });
  await expect(client.evaluate(request, new AbortController().signal)).rejects.toThrow(
    'invalid typed answers',
  );
  expect(client.metrics().successfulRequests).toBe(0);
});

it.each([true, false])('bounds response size with Content-Length present=%s', async (declared) => {
  const client = new JevClient({
    apiKey: 'unit-test-key',
    fetcher: async () =>
      new Response('x'.repeat(256 * 1024 + 1), {
        headers: declared ? { 'content-length': String(256 * 1024 + 1) } : {},
      }),
  });
  await expect(client.evaluate(request, new AbortController().signal)).rejects.toThrow(
    'unavailable',
  );
});

it('does not retry rate limits or expose upstream error bodies', async () => {
  const fetcher = vi.fn<Fetcher>(async () =>
    Response.json({ error: 'private upstream body' }, { status: 429 }),
  );
  const client = new JevClient({ apiKey: 'unit-test-key', fetcher });
  await expect(client.evaluate(request, new AbortController().signal)).rejects.toThrow(
    'Jev evaluation is unavailable or returned invalid typed answers.',
  );
  expect(fetcher).toHaveBeenCalledOnce();
});

it('keeps omitted token counts unknown without discarding valid typed decisions', async () => {
  const body = { ...response(), usage: {} };
  const client = new JevClient({
    apiKey: 'unit-test-key',
    fetcher: async () => Response.json(body),
  });
  await client.evaluate(request, new AbortController().signal);
  expect(client.metrics()).toMatchObject({
    successfulRequests: 1,
    inputTokens: null,
    outputTokens: null,
  });
});

it('skips aborted requests and forwards cancellation to the SDK transport', async () => {
  const controller = new AbortController();
  let transportSignal!: AbortSignal;
  const fetcher = vi.fn<Fetcher>(
    async (_url, options) =>
      new Promise((_resolve, reject) => {
        transportSignal = options!.signal!;
        transportSignal.addEventListener('abort', () => reject(new Error('aborted')), {
          once: true,
        });
      }),
  );
  const client = new JevClient({ apiKey: 'unit-test-key', fetcher });
  const pending = client.evaluate(request, controller.signal);
  const assertion = expect(pending).rejects.toThrow();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  controller.abort();
  await assertion;
  expect(transportSignal.aborted).toBe(true);
  await expect(client.evaluate(request, controller.signal)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledOnce();
});
