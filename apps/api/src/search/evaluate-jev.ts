import type { Fetcher } from '@hk/providers';
import { createJevAssistant } from './jev-config';
import { runDiscoveryEvaluation } from './run-discovery-evaluation';

/** Only the explicit Jev command uses the external provider; reference/replay checks stay offline. */
export async function evaluateJev(
  env: Record<string, string | undefined>,
  signal: AbortSignal,
  fetcher?: Fetcher,
) {
  if (env.HK_DATA_MODE === 'fixture') throw new Error('Jev evaluation requires HK_DATA_MODE=live.');
  const { assistant, client } = createJevAssistant(env, fetcher);
  const result = await runDiscoveryEvaluation(
    assistant,
    { provider: 'TypeSafe', model: client.model },
    signal,
  );
  const provider = client.metrics();
  return {
    ...result.report,
    mode: 'jev-evaluation',
    liveModelRun: !fetcher && provider.successfulRequests > 0,
    note: fetcher
      ? 'Injected transport test only; not evidence of an external Jev model run.'
      : 'TypeSafe API execution with the reference curated catalogue. Review case outputs and observed model identifiers before enabling the opt-in evaluation UI. Cost and production-source coverage are not verified.',
    cancelled: result.cancelled,
    execution: result.execution,
    provider,
    replay: result.replay,
  };
}
