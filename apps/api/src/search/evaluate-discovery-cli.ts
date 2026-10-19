import { readFileSync, statSync } from 'node:fs';
import { discoveryReplaySchema, evaluateDiscovery } from './discovery-evaluation';
import { evaluateJev } from './evaluate-jev';

const args = process.argv.slice(2);
if (
  args.length &&
  !(args.length === 1 && args[0] === '--jev') &&
  (args.length !== 2 || args[0] !== '--responses')
)
  throw new Error(
    'Usage: tsx src/search/evaluate-discovery-cli.ts [--responses path/to/responses.json | --jev]',
  );
if (args[0] === '--jev') {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const report = await evaluateJev(
      process.env,
      AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]),
    );
    console.info(JSON.stringify(report, null, 2));
    if (report.failed || report.cancelled) process.exitCode = 1;
  } catch {
    console.info(
      JSON.stringify(
        {
          mode: 'jev-evaluation',
          status: 'not-run',
          liveModelRun: false,
          rollout: 'blocked',
          reason:
            'Jev requires live data mode and TYPESAFE_API_KEY in server environment secrets. Check the model configuration as well. No provider error details are logged.',
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
} else {
  const path = args[1];
  if (path && statSync(path).size > 1024 * 1024)
    throw new Error('Evaluation replay must be at most 1 MiB.');
  const replay = path
    ? discoveryReplaySchema.parse(JSON.parse(readFileSync(path, 'utf8')))
    : undefined;
  const report = evaluateDiscovery(replay);
  console.info(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}
