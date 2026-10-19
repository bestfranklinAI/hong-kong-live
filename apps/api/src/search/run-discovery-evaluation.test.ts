import { expect, it, vi } from 'vitest';
import type { DiscoveryAssistant } from './discovery';
import { discoveryEvaluationCases } from './discovery-evaluation-cases';
import { modelCandidates, retrieveDiscoveryCandidates } from './discovery-retrieval';
import { runDiscoveryEvaluation } from './run-discovery-evaluation';

const identity = { provider: 'test-double', model: 'reference-expectations' };
const assistant = (): DiscoveryAssistant => ({
  interpret: vi.fn<DiscoveryAssistant['interpret']>(async ({ query }) =>
    structuredClone(
      discoveryEvaluationCases.find((test) => test.request.query === query)!.expected,
    ),
  ),
  rank: vi.fn<DiscoveryAssistant['rank']>(async ({ query, candidates }) => {
    const test = discoveryEvaluationCases.find((test) => test.request.query === query)!;
    const first =
      test.expectedTopIds?.find((id) => candidates.some((row) => row.id === id)) ??
      candidates[0].id;
    return { candidateIds: [first] };
  }),
});

it('executes all cases without passing answer keys or coordinates to interpretation or ranking', async () => {
  const model = assistant();
  const result = await runDiscoveryEvaluation(model, identity, new AbortController().signal);
  expect(result.execution).toHaveLength(8);
  expect(result.execution.every((row) => row.status === 'completed' && row.elapsedMs >= 0)).toBe(
    true,
  );
  expect(result.report.passed).toBe(8);
  expect(result.report.liveModelRun).toBe(false);
  expect(result.report.rollout).toBe('human-review-required');
  expect(model.interpret).toHaveBeenCalledTimes(8);
  expect(model.rank).toHaveBeenCalledTimes(6);
  for (const test of discoveryEvaluationCases) {
    expect(model.interpret).toHaveBeenCalledWith(
      { query: test.request.query, language: test.request.language },
      expect.any(AbortSignal),
    );
    const pool = retrieveDiscoveryCandidates(test.expected, test.request);
    if (pool.length)
      expect(model.rank).toHaveBeenCalledWith(
        {
          query: test.request.query,
          language: test.request.language,
          intent: test.expected,
          candidates: modelCandidates(pool),
        },
        expect.any(AbortSignal),
      );
  }
});

it('uses the actual interpretation for retrieval even when it disagrees with the answer key', async () => {
  const model = assistant();
  const intent = {
    interests: ['park'] as const,
    area: '',
    mobility: 'walking' as const,
    unverifiedNeeds: [],
  };
  model.interpret = vi.fn(async () => intent);
  const result = await runDiscoveryEvaluation(model, identity, new AbortController().signal);
  expect(result.report.failed).toBe(7);
  expect(result.report.rollout).toBe('blocked');
  expect(model.rank).toHaveBeenCalledWith(
    {
      query: discoveryEvaluationCases[0].request.query,
      language: 'tc',
      intent,
      candidates: modelCandidates(
        retrieveDiscoveryCandidates(
          { ...intent, interests: ['park'] },
          discoveryEvaluationCases[0].request,
        ),
      ),
    },
    expect.any(AbortSignal),
  );
});

it('does not score retrieval fallbacks as successful model rankings or expose provider errors', async () => {
  const model = assistant();
  model.rank = vi.fn(async () => {
    throw new Error('Private provider request details');
  });
  const result = await runDiscoveryEvaluation(model, identity, new AbortController().signal);
  expect(result.execution.filter((row) => row.status === 'ranking-failed')).toHaveLength(6);
  expect(result.report.failed).toBe(6);
  expect(result.report.passed).toBe(2);
  expect(result.report.rollout).toBe('blocked');
  expect(JSON.stringify(result)).not.toContain('Private provider');
});

it('continues after interpretation failure and counts missing responses as unrun', async () => {
  const model = assistant();
  model.interpret = vi.fn(async () => {
    throw new Error('Private failure');
  });
  const result = await runDiscoveryEvaluation(model, identity, new AbortController().signal);
  expect(model.interpret).toHaveBeenCalledTimes(8);
  expect(model.rank).not.toHaveBeenCalled();
  expect(result.report.failed).toBe(8);
  expect(result.report.modelCasesUnrun).toBe(8);
  expect(JSON.stringify(result)).not.toContain('Private failure');
});

it('cancels an unresponsive assistant and skips remaining cases without capturing its late reply', async () => {
  const abort = new AbortController();
  const model = assistant();
  let finish!: (value: unknown) => void;
  model.interpret = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = runDiscoveryEvaluation(model, identity, abort.signal);
  await vi.waitFor(() => expect(model.interpret).toHaveBeenCalledOnce());
  abort.abort();
  const result = await pending;
  finish(discoveryEvaluationCases[0].expected);
  await Promise.resolve();
  expect(model.rank).not.toHaveBeenCalled();
  expect(model.interpret).toHaveBeenCalledOnce();
  expect(result.cancelled).toBe(true);
  expect(result.execution).toHaveLength(1);
  expect(result.execution[0].status).toBe('cancelled');
  expect(result.replay.cases).toEqual([]);
  expect(result.report.modelCasesUnrun).toBe(8);
});
