import { expect, it } from 'vitest';
import { discoveryEvaluationCases } from './discovery-evaluation-cases';
import { discoveryReplaySchema, evaluateDiscovery } from './discovery-evaluation';
import { retrieveDiscoveryCandidates } from './discovery-retrieval';

const replay = () => ({
  provider: 'test-double',
  model: 'reference-expectations',
  cases: discoveryEvaluationCases.map((test) => {
    const pool = retrieveDiscoveryCandidates(test.expected, test.request);
    const first =
      test.expectedTopIds?.find((id) => pool.some((row) => row.result.id === id)) ??
      pool[0]?.result.id;
    return {
      id: test.id,
      interpretation: test.expected,
      ranking: { candidateIds: first ? [first] : [] },
    };
  }),
});

it('reports all model cases unrun for reference-only pipeline checks', () => {
  const report = evaluateDiscovery();
  expect(report.total).toBe(8);
  expect(report.modelEvaluated).toBe(false);
  expect(report.modelCasesUnrun).toBe(8);
  expect(report.passed).toBe(0);
  expect(report.failed).toBe(0);
  expect(report.rollout).toBe('blocked');
});

it('scores response replays without calling them live model validation or enabling rollout', () => {
  const report = evaluateDiscovery(discoveryReplaySchema.parse(replay()));
  expect(report.passed).toBe(8);
  expect(report.failed).toBe(0);
  expect(report.liveModelRun).toBe(false);
  expect(report.rollout).toBe('human-review-required');
});

it('fails missing responses, incorrect negation, and unknown ranking IDs', () => {
  const missing = evaluateDiscovery({ ...replay(), cases: [] });
  expect(missing.failed).toBe(8);
  expect(missing.modelCasesUnrun).toBe(8);
  expect(missing.modelEvaluated).toBe(false);
  const cases = replay().cases;
  cases[0].ranking.candidateIds = ['invented:cafe'];
  cases[3].interpretation = { ...cases[3].interpretation, interests: ['culture'] };
  const result = evaluateDiscovery({ ...replay(), cases });
  expect(result.failed).toBe(2);
  expect(result.rollout).toBe('blocked');
});
