import { JevClient, JEV_DEFAULT_MODEL } from '@hk/providers/jev';
import type { Fetcher } from '@hk/providers';
import type { DataMode } from '@hk/contracts';
import { JevDiscoveryAssistant } from './jev';

type Environment = Record<string, string | undefined>;

export function createJevAssistant(env: Environment, fetcher?: Fetcher) {
  if (!env.TYPESAFE_API_KEY?.trim())
    throw new Error('Set TYPESAFE_API_KEY in server environment secrets to use Jev.');
  const client = new JevClient({
    apiKey: env.TYPESAFE_API_KEY,
    model: env.TYPESAFE_DEFAULT_MODEL?.trim() || JEV_DEFAULT_MODEL,
    fetcher,
  });
  return { assistant: new JevDiscoveryAssistant(client), client };
}

/** An explicit operator flag enables only the existing opt-in evaluation UI. */
export function jevRuntimeOptions(env: Environment, mode: DataMode, fetcher?: Fetcher) {
  if (mode === 'fixture') return {};
  const flag = env.HK_DISCOVERY_EVALUATION ?? '0';
  if (flag !== '0' && flag !== '1') throw new Error('HK_DISCOVERY_EVALUATION must be 0 or 1.');
  if (flag === '0') return {};
  return {
    enableDiscoveryEvaluation: true,
    discoveryAssistant: createJevAssistant(env, fetcher).assistant,
  };
}
