import { discoveryReplaySchema, type DiscoveryReplay } from '@hk/contracts';
import { DiscoverySearch, type DiscoveryAssistant } from './discovery';
import { discoveryEvaluationCases } from './discovery-evaluation-cases';
import { evaluateDiscovery } from './discovery-evaluation';
import { retrieveDiscoveryCandidates } from './discovery-retrieval';

/** Executes the assistant contract; labels alone do not establish a real provider/model run. */
export async function runDiscoveryEvaluation(
  assistant: DiscoveryAssistant,
  identity: Pick<DiscoveryReplay, 'provider' | 'model'>,
  signal: AbortSignal,
) {
  const replay = discoveryReplaySchema.parse({ ...identity, cases: [] });
  const execution: {
    id: string;
    status: 'completed' | 'ranking-failed' | 'failed' | 'cancelled';
    elapsedMs: number;
  }[] = [];

  // Serial execution bounds external requests. Reference answers never enter model inputs.
  for (const test of discoveryEvaluationCases) {
    if (signal.aborted) break;
    let response: DiscoveryReplay['cases'][number] | undefined;
    const tracked: DiscoveryAssistant = {
      async interpret(request, cancellation) {
        const interpretation = await assistant.interpret(request, cancellation);
        cancellation.throwIfAborted();
        response = { id: test.id, interpretation };
        return interpretation;
      },
      async rank(request, cancellation) {
        const ranking = await assistant.rank(request, cancellation);
        cancellation.throwIfAborted();
        if (response) response.ranking = ranking;
        return ranking;
      },
    };
    const started = performance.now();
    let status: (typeof execution)[number]['status'];
    try {
      const result = await new DiscoverySearch(tracked, retrieveDiscoveryCandidates).search(
        test.request,
        signal,
      );
      status = result.ranking === 'retrieval-fallback' ? 'ranking-failed' : 'completed';
    } catch {
      // Provider errors may contain private request details. Retain only the failure category.
      status = signal.aborted ? 'cancelled' : 'failed';
    }
    execution.push({ id: test.id, status, elapsedMs: Math.round(performance.now() - started) });
    if (response) replay.cases.push(response);
  }

  return {
    replay,
    report: evaluateDiscovery(replay),
    execution,
    cancelled: signal.aborted,
    scope:
      'Injected assistant with the reference curated catalogue; external provider identity, cost and production source coverage are not verified.',
  };
}
