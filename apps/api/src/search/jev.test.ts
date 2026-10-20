import { expect, it, vi } from 'vitest';
import { JevClient, type Questions } from '@hk/providers/jev';
import type { Fetcher } from '@hk/providers';
import type { DiscoveryIntent } from '@hk/contracts';
import { JevDiscoveryAssistant } from './jev';
import { jevAreaCandidates } from './jev-areas';
import { jevRuntimeOptions } from './jev-config';
import { retrieveDiscoveryCandidates, modelCandidates } from './discovery-retrieval';
import { discoveryEvaluationCases } from './discovery-evaluation-cases';
import { evaluateJev } from './evaluate-jev';
import { createApp } from '../app';

interface Body {
  state: { query: string; language: string; candidates?: { id: string }[] };
  questions: Questions;
}
function typedResponse(body: Body, intent: DiscoveryIntent, scores: number[] = [], confidence = 1) {
  const area =
    Object.entries(body.questions.area?.type === 'choice' ? body.questions.area.criteria : {}).find(
      ([, label]) =>
        label === intent.area ||
        (intent.area === '中環' && label === 'Central') ||
        (intent.area === '西九' && label === 'West Kowloon'),
    )?.[0] ?? 'none';
  return {
    model: 'jev-test-double',
    usage: { input_tokens: 20, output_tokens: null },
    answers: Object.fromEntries(
      Object.entries(body.questions).map(([id, question]) => {
        if (question.type === 'noul') {
          const yes =
            id === 'prefer_cover'
              ? !!intent.routePreferences?.preferCover
              : id.startsWith('interest_')
                ? intent.interests.includes(id.slice(9) as DiscoveryIntent['interests'][number])
                : intent.unverifiedNeeds.includes(
                    id.slice(5) as DiscoveryIntent['unverifiedNeeds'][number],
                  );
          return [id, { type: 'noul', noul: yes ? 1 : 0 }];
        }
        if (question.type === 'choice') {
          const selected = id === 'mobility' ? intent.mobility : area;
          return [
            id,
            {
              type: 'choice',
              choice: selected,
              confidence,
              probabilities: Object.fromEntries(
                Object.keys(question.criteria).map((key) => [key, key === selected ? 1 : 0]),
              ),
            },
          ];
        }
        const value = scores[Number(id.slice(10))] ?? 3;
        const low = Math.floor(value),
          high = Math.ceil(value);
        return [
          id,
          {
            type: 'score',
            score: value,
            confidence,
            probabilities: Object.fromEntries(
              [0, 1, 2, 3].map((key) => [
                key,
                low === high
                  ? key === low
                    ? 1
                    : 0
                  : key === low
                    ? high - value
                    : key === high
                      ? value - low
                      : 0,
              ]),
            ),
          },
        ];
      }),
    ),
  };
}
const request = discoveryEvaluationCases[0].request;
const intent = discoveryEvaluationCases[0].expected;
const configured = { HK_DISCOVERY_EVALUATION: '1', TYPESAFE_API_KEY: 'unit-test-key' };

it('builds strict Cantonese preferences from independent Noul/Choice answers without JSON generation', async () => {
  const calls: Body[] = [];
  const client = new JevClient({
    apiKey: 'unit-test-key',
    fetcher: async (_url, options) => {
      const body: Body = JSON.parse(options!.body as string);
      calls.push(body);
      return Response.json(typedResponse(body, intent));
    },
  });
  expect(
    await new JevDiscoveryAssistant(client).interpret(request, new AbortController().signal),
  ).toEqual(intent);
  expect(calls[0].state).toEqual({ query: request.query, language: request.language });
  expect(Object.keys(calls[0].questions)).toHaveLength(14);
  expect(calls[0].questions.interest_food.type).toBe('noul');
  expect(calls[0].questions.mobility.type).toBe('choice');
  expect(JSON.stringify(calls[0])).not.toContain('coordinates');
});

it('selects only named area labels and does not confuse Central with an English substring', async () => {
  expect(jevAreaCandidates('decentralized museum')).toEqual([]);
  expect(jevAreaCandidates('西九博物館')).toContain('West Kowloon');
  const test = discoveryEvaluationCases[2];
  const assistant = new JevDiscoveryAssistant(
    new JevClient({
      apiKey: 'unit-test-key',
      fetcher: async (_url, options) =>
        Response.json(typedResponse(JSON.parse(options!.body as string), test.expected)),
    }),
  );
  expect(await assistant.interpret(test.request, new AbortController().signal)).toEqual({
    ...test.expected,
    area: 'Central',
  });
});

it('abstains on uncertain mobility decisions', async () => {
  const assistant = new JevDiscoveryAssistant(
    new JevClient({
      apiKey: 'unit-test-key',
      fetcher: async (_url, options) =>
        Response.json(typedResponse(JSON.parse(options!.body as string), intent, [], 0.4)),
    }),
  );
  await expect(assistant.interpret(request, new AbortController().signal)).rejects.toThrow(
    'Uncertain',
  );
});

it('rejects unsupported named areas rather than silently searching all Hong Kong', async () => {
  const assistant = new JevDiscoveryAssistant(
    new JevClient({
      apiKey: 'unit-test-key',
      fetcher: async (_url, options) => {
        const body: Body = JSON.parse(options!.body as string);
        const reply = typedResponse(body, intent);
        const areaQuestion = body.questions.area;
        if (areaQuestion.type !== 'choice') throw new Error('Expected area choice');
        reply.answers.area = {
          type: 'choice',
          choice: 'unsupported',
          confidence: 1,
          probabilities: Object.fromEntries(
            Object.keys(areaQuestion.criteria).map((key) => [key, key === 'unsupported' ? 1 : 0]),
          ),
        };
        return Response.json(reply);
      },
    }),
  );
  await expect(
    assistant.interpret(
      { query: 'A waterfront walk in a named area outside the supported labels', language: 'en' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('standard place search');
});

it('scores source candidates and composes a deterministic ranking without sending positions', async () => {
  let sent!: Body;
  const candidates = modelCandidates(retrieveDiscoveryCandidates(intent, request));
  const assistant = new JevDiscoveryAssistant(
    new JevClient({
      apiKey: 'unit-test-key',
      fetcher: async (_url, options) => {
        sent = JSON.parse(options!.body as string);
        return Response.json(typedResponse(sent, intent, [1, 3, 2.5]));
      },
    }),
  );
  const ranked = await assistant.rank(
    { ...request, intent, candidates },
    new AbortController().signal,
  );
  expect(ranked.candidateIds).toEqual([candidates[1].id, candidates[2].id]);
  expect(sent.state.candidates).toEqual(candidates);
  expect(JSON.stringify(sent.state)).not.toContain('location');
  expect(Object.values(sent.questions).every((question) => question.type === 'score')).toBe(true);
});

it('keeps an accepted park alongside higher-scoring restaurants for a mixed request', async () => {
  const preference: DiscoveryIntent = {
    interests: ['park', 'food'],
    area: '',
    mobility: 'walking',
    unverifiedNeeds: [],
  };
  const candidates = Array.from({ length: 10 }, (_, index) => ({
    id: `candidate:${index}`,
    name: index === 0 ? 'Park' : `Restaurant ${index}`,
    nameZh: '',
    district: 'Central',
    source: index === 0 ? ('LCSD' as const) : ('FEHD' as const),
    interests: [index === 0 ? ('park' as const) : ('food' as const)],
    description: '',
  }));
  const client = new JevClient({
    apiKey: 'unit-test-key',
    fetcher: async (_url, options) => {
      const body: Body = JSON.parse(options!.body as string);
      return Response.json(typedResponse(body, preference, [2, 3, 3, 3, 3, 3, 3, 3, 3, 3]));
    },
  });
  const result = await new JevDiscoveryAssistant(client).rank(
    { query: 'Find a park and food nearby', language: 'en', intent: preference, candidates },
    new AbortController().signal,
  );
  expect(result.candidateIds).toHaveLength(8);
  expect(result.candidateIds[0]).toBe('candidate:0');
  expect(result.candidateIds).toContain('candidate:1');
});

it('uses the explicit runtime gate and keeps fixture mode isolated even with a configured key', async () => {
  const fetcher = vi.fn<Fetcher>();
  expect(jevRuntimeOptions({}, 'live', fetcher)).toEqual({});
  expect(jevRuntimeOptions(configured, 'fixture', fetcher)).toEqual({});
  expect(() => jevRuntimeOptions({ HK_DISCOVERY_EVALUATION: '1' }, 'live')).toThrow(
    'TYPESAFE_API_KEY',
  );
  expect(() => jevRuntimeOptions({ HK_DISCOVERY_EVALUATION: 'true' }, 'live')).toThrow('0 or 1');
  expect(fetcher).not.toHaveBeenCalled();
  const app = createApp({
    mode: 'live',
    ...jevRuntimeOptions(configured, 'live', async (_url, options) =>
      Response.json(typedResponse(JSON.parse(options!.body as string), intent)),
    ),
  });
  expect(await (await app.request('/api/v1/search/discovery/status')).json()).toEqual({
    experimental: true,
    enabled: true,
  });
  const response = await app.request('/api/v1/search/discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.ranking).toBe('model');
  expect(result.unmatchedInterests).toEqual(['food']);
  expect(result.results[0]).toEqual(retrieveDiscoveryCandidates(intent, request)[0].result);
});

it('executes the twelve-case Jev path through an injected transport without claiming live model evidence', async () => {
  const fetcher = vi.fn<Fetcher>(async (_url, options) => {
    const body: Body = JSON.parse(options!.body as string);
    const test = discoveryEvaluationCases.find((row) => row.request.query === body.state.query)!;
    const scores = body.state.candidates?.map((row) =>
      test.expectedTopIds?.includes(row.id) ? 3 : 2,
    );
    return Response.json(typedResponse(body, test.expected, scores));
  });
  const report = await evaluateJev(configured, new AbortController().signal, fetcher);
  expect(report.passed).toBe(12);
  expect(report.failed).toBe(0);
  expect(report.rollout).toBe('human-review-required');
  expect(report.liveModelRun).toBe(false);
  expect(report.provider.attemptedRequests).toBe(22);
  expect(report.provider.observedModels).toEqual(['jev-test-double']);
  await expect(
    evaluateJev({ ...configured, HK_DATA_MODE: 'fixture' }, new AbortController().signal, fetcher),
  ).rejects.toThrow('live');
  expect(fetcher).toHaveBeenCalledTimes(22);
});
