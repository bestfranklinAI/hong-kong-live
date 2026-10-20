import {
  discoveryIntentSchema,
  discoveryRankingSchema,
  discoveryRequestSchema,
  discoveryResponseSchema,
  type DiscoveryIntent,
  type DiscoveryRequest,
  type DiscoveryResponse,
  type DataMode,
} from '@hk/contracts';
import type { SearchRepository } from './repository';
import { modelCandidates, type DiscoveryCandidate } from './discovery-retrieval';

/** Provider protocol stays outside the grounded search engine. Inputs/outputs are untrusted. */
export interface DiscoveryAssistant {
  interpret(
    request: Pick<DiscoveryRequest, 'query' | 'language'>,
    signal: AbortSignal,
  ): Promise<unknown>;
  rank(
    request: {
      query: string;
      language: DiscoveryRequest['language'];
      intent: DiscoveryIntent;
      candidates: ReturnType<typeof modelCandidates>;
    },
    signal: AbortSignal,
  ): Promise<unknown>;
}

export function groundedRanking(output: unknown, candidates: DiscoveryCandidate[]) {
  const ranking = discoveryRankingSchema.parse(output);
  const source = new Map(candidates.map((candidate) => [candidate.result.id, candidate.result]));
  if (ranking.candidateIds.some((id) => !source.has(id)))
    throw new Error('Ranking contained an unknown place.');
  return ranking.candidateIds.map((id) => source.get(id)!);
}

/** A stalled adapter cannot keep an evaluation request alive after its deadline. */
function withCancellation<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return task();
      })
      .then(
        (value) => {
          signal.removeEventListener('abort', abort);
          if (signal.aborted) reject(signal.reason);
          else resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        },
      );
  });
}

function notices(intent: DiscoveryIntent, request: DiscoveryRequest) {
  const values = [
    'Experimental search. Place coordinates are source references, not verified entrances. Routes are calculated separately by the government routing service.',
  ];
  if (intent.mobility !== 'walking')
    values.push(
      'Compare the official Recommended, Shortest and Barrier-free routes. A fewer-stairs preference or Barrier-free profile does not verify access or working lifts.',
    );
  if (intent.interests.includes('food'))
    values.push(
      request.center
        ? `Nearby means within about ${(request.radiusM ?? 2000) / 1000} km straight-line of the selected map reference, not a walking connection. Only restaurants with known coordinates are included.`
        : 'Nearby food needs a map reference or named area. No restaurant location is invented.',
    );
  const needs: Record<DiscoveryIntent['unverifiedNeeds'][number], string> = {
    'open-now': 'Current opening hours are not verified.',
    'working-lifts': 'Current lift operation is not verified.',
    'indoor-position': 'Indoor positions and floors cannot be identified from this search.',
    'covered-walk': 'A continuously covered walking route is not verified.',
  };
  values.push(...intent.unverifiedNeeds.map((need) => needs[need]));
  return values;
}

export class DiscoverySearch {
  constructor(
    private assistant: DiscoveryAssistant,
    private retrieve: (intent: DiscoveryIntent, request: DiscoveryRequest) => DiscoveryCandidate[],
    private mode: DataMode = 'live',
    private catalogueStatus?: SearchRepository['status'],
  ) {}

  async search(input: unknown, cancellation: AbortSignal): Promise<DiscoveryResponse> {
    const request = discoveryRequestSchema.parse(input);
    const signal = AbortSignal.any([cancellation, AbortSignal.timeout(10000)]);
    signal.throwIfAborted();
    const intent = discoveryIntentSchema.parse(
      await withCancellation(
        () =>
          this.assistant.interpret({ query: request.query, language: request.language }, signal),
        signal,
      ),
    );
    signal.throwIfAborted();
    const candidates = this.retrieve(intent, request).slice(0, 24);
    let results = candidates.slice(0, 8).map((candidate) => candidate.result);
    let ranking: DiscoveryResponse['ranking'] = candidates.length ? 'model' : 'not-run';
    const warnings = notices(intent, request);
    const catalogue = this.catalogueStatus?.(Date.now());
    const unmatchedInterests = intent.interests.filter(
      (interest) => !candidates.some((candidate) => candidate.interests.includes(interest)),
    );
    for (const interest of unmatchedInterests)
      warnings.push(`No mapped ${interest} candidates matched the available catalogue and area.`);
    if (candidates.length) {
      try {
        const output = await withCancellation(
          () =>
            this.assistant.rank(
              {
                query: request.query,
                language: request.language,
                intent,
                candidates: modelCandidates(candidates),
              },
              signal,
            ),
          signal,
        );
        signal.throwIfAborted();
        results = groundedRanking(output, candidates);
      } catch {
        signal.throwIfAborted();
        ranking = 'retrieval-fallback';
        warnings.push(
          'Model ranking was unavailable or invalid; showing candidates in retrieval order.',
        );
      }
    }
    signal.throwIfAborted();
    if (!results.length)
      warnings.push(
        candidates.length
          ? 'The assistant did not select a source candidate. Try standard place search.'
          : 'No grounded candidates matched the available catalogue and area.',
      );
    const alternatives =
      candidates.length && !results.length
        ? candidates.slice(0, 3).map((candidate) => candidate.result)
        : [];
    if (alternatives.length)
      warnings.push(
        'These retrieved alternatives were not selected by Jev. Check them yourself; they do not verify the requested access or opening requirements.',
      );
    return discoveryResponseSchema.parse({
      experimental: true,
      mode: this.mode,
      intent,
      ranking,
      unmatchedInterests,
      results,
      alternatives,
      coverage: {
        radiusM: request.radiusM ?? 2000,
        referenceProvided: !!request.center,
        candidateCount: candidates.length,
        restaurantsTotal: catalogue?.count ?? 0,
        restaurantsMapped: catalogue?.resolved ?? 0,
      },
      notices: warnings,
    });
  }
}
