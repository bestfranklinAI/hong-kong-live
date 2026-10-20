import { discoveryIntentSchema, normalizeSearchText, type DiscoveryReplay } from '@hk/contracts';
import { discoveryEvaluationCases } from './discovery-evaluation-cases';
import { retrieveDiscoveryCandidates, modelCandidates } from './discovery-retrieval';
import { groundedRanking } from './discovery';

export { discoveryReplaySchema } from '@hk/contracts';
const sameSet = (a: string[], b: string[]) => [...a].sort().join('|') === [...b].sort().join('|');

export function evaluateDiscovery(replay?: DiscoveryReplay) {
  if (replay?.cases.some((row) => !discoveryEvaluationCases.some((test) => test.id === row.id)))
    throw new Error('Replay contains an unknown evaluation case.');
  const cases = discoveryEvaluationCases.map((test) => {
    const reference = discoveryIntentSchema.parse(test.expected);
    const referencePool = retrieveDiscoveryCandidates(reference, test.request);
    if (
      test.expectedTopIds &&
      !referencePool.some((candidate) => test.expectedTopIds!.includes(candidate.result.id))
    )
      return {
        id: test.id,
        status: 'failed' as const,
        reason: 'Reference catalogue does not contain an expected candidate.',
      };
    if (!replay)
      return {
        id: test.id,
        status: 'reference-only' as const,
        candidateIds: referencePool.map((candidate) => candidate.result.id),
        referencePipeline: {
          request: { query: test.request.query, language: test.request.language },
          referenceIntent: reference,
          referenceCandidates: modelCandidates(referencePool),
        },
      };
    const row = replay.cases.find((item) => item.id === test.id);
    if (!row) return { id: test.id, status: 'failed' as const, reason: 'Missing model response.' };
    const parsed = discoveryIntentSchema.safeParse(row.interpretation);
    if (!parsed.success)
      return { id: test.id, status: 'failed' as const, reason: 'Invalid intent contract.' };
    const intent = parsed.data;
    const areas = (test.acceptedAreas ?? [reference.area]).map(normalizeSearchText);
    if (
      !sameSet(intent.interests, reference.interests) ||
      intent.mobility !== reference.mobility ||
      !!intent.routePreferences?.preferCover !== !!reference.routePreferences?.preferCover ||
      !sameSet(intent.unverifiedNeeds, reference.unverifiedNeeds) ||
      !areas.includes(normalizeSearchText(intent.area))
    )
      return {
        id: test.id,
        status: 'failed' as const,
        reason: 'Preferences, negation, area or unknown requirements differ from the reference.',
      };
    const pool = retrieveDiscoveryCandidates(intent, test.request);
    if (!pool.length && test.expectedTopIds)
      return {
        id: test.id,
        status: 'failed' as const,
        reason: 'Interpretation retrieved no expected candidates.',
      };
    if (!pool.length)
      return { id: test.id, status: 'passed' as const, ranking: 'not-run' as const };
    if (row.ranking === undefined)
      return { id: test.id, status: 'failed' as const, reason: 'No usable ranking response.' };
    try {
      const results = groundedRanking(row.ranking, pool);
      if (!results.length || (test.expectedTopIds && !test.expectedTopIds.includes(results[0].id)))
        return { id: test.id, status: 'failed' as const, reason: 'No appropriate top candidate.' };
      return {
        id: test.id,
        status: 'passed' as const,
        ranking: 'response-replay' as const,
        candidateIds: results.map((result) => result.id),
      };
    } catch {
      return {
        id: test.id,
        status: 'failed' as const,
        reason: 'Ranking violated the candidate-ID contract.',
      };
    }
  });
  const passed = cases.filter((row) => row.status === 'passed').length;
  return {
    mode: replay ? 'response-replay' : 'reference-checks',
    modelEvaluated: !!replay?.cases.length,
    liveModelRun: false,
    providerLabel: replay?.provider ?? null,
    modelLabel: replay?.model ?? null,
    total: cases.length,
    passed,
    failed: cases.filter((row) => row.status === 'failed').length,
    modelCasesUnrun: replay
      ? discoveryEvaluationCases.filter((test) => !replay.cases.some((row) => row.id === test.id))
          .length
      : cases.length,
    rollout: replay && passed === cases.length ? 'human-review-required' : 'blocked',
    note: replay
      ? 'Supplied response replay; provider identity and live latency/cost are not verified.'
      : 'Reference pipeline only. This report contains no external Jev evaluation; do not enable broad rollout.',
    cases,
  };
}
