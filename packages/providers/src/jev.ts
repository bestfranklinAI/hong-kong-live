import { TypeSafeClient, type SystemOneRequest } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { ProviderError, type Fetcher } from './http';

export { choice, noul, score } from '@typesafe-ai/sdk';
export type { Questions } from '@typesafe-ai/sdk';
export const JEV_API_URL = 'https://api.typesafe.ai';
export const JEV_DEFAULT_MODEL = 'jev-latest';
const MAX_BYTES = 256 * 1024;
const probability = z.number().finite().min(0).max(1);
const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('noul'), noul: probability }),
  z.object({
    type: z.literal('choice'),
    choice: z.string(),
    confidence: probability,
    probabilities: z.record(z.string(), probability),
  }),
  z.object({
    type: z.literal('score'),
    score: z.number().finite().min(0),
    confidence: probability,
    probabilities: z.record(z.string(), probability),
  }),
]);
const responseSchema = z.object({
  model: z.string().min(1).max(100),
  answers: z.record(z.string(), answerSchema),
  usage: z.object({
    input_tokens: z.number().int().min(0).nullable().default(null),
    output_tokens: z.number().int().min(0).nullable().default(null),
  }),
});
const sameKeys = (a: object, b: object) => {
  const left = Object.keys(a).sort(),
    right = Object.keys(b).sort();
  return left.length === right.length && left.every((key, index) => key === right[index]);
};

// Jev 1.13 returns independently rounded two-decimal probabilities and scores.
// Check for a compatible normalized distribution within half a rounding unit.
// This avoids rejecting valid rounded answers while still rejecting inconsistent scores.
const HALF_UNIT = 0.005;
const EPSILON = 1e-10;
function distributionBounds(probabilities: Record<string, number>) {
  const rows = Object.entries(probabilities).map(([key, value]) => ({
    key,
    low: Math.max(0, value - HALF_UNIT),
    high: Math.min(1, value + HALF_UNIT),
  }));
  const low = rows.reduce((total, row) => total + row.low, 0);
  const high = rows.reduce((total, row) => total + row.high, 0);
  if (low > 1 + EPSILON || high < 1 - EPSILON) throw new Error('Invalid probability distribution');
  const expected = (descending: boolean) => {
    let remaining = Math.max(0, 1 - low);
    let value = rows.reduce((total, row) => total + Number(row.key) * row.low, 0);
    for (const row of [...rows].sort(
      (a, b) => (Number(a.key) - Number(b.key)) * (descending ? -1 : 1),
    )) {
      const added = Math.min(remaining, row.high - row.low);
      value += added * Number(row.key);
      remaining -= added;
    }
    return value;
  };
  return { minimumScore: () => expected(false), maximumScore: () => expected(true) };
}

/** Server-only SDK transport. The endpoint is fixed so environment overrides cannot redirect keys. */
export class JevClient {
  private client: TypeSafeClient;
  private successful = 0;
  private inputTokens: number | null = 0;
  private outputTokens: number | null = 0;
  private observedModels = new Set<string>();
  private attempts = 0;
  readonly model: string;

  constructor(options: { apiKey: string; model?: string; fetcher?: Fetcher }) {
    if (!options.apiKey.trim()) throw new ProviderError('TYPESAFE_API_KEY is required.');
    this.model = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(options.model ?? JEV_DEFAULT_MODEL);
    const fetcher = options.fetcher ?? fetch;
    this.client = new TypeSafeClient({
      apiKey: options.apiKey,
      baseURL: JEV_API_URL,
      defaultModel: this.model,
      timeout: 9000,
      retry: { maxRetries: 0 },
      logLevel: 'off',
      compression: false,
      fetch: async (url, init) => {
        const response = await fetcher(url, { ...init, redirect: 'error' });
        if (!response.body) return response;
        if (Number(response.headers.get('content-length')) > MAX_BYTES) {
          await response.body.cancel();
          throw new ProviderError('Jev response exceeded the size limit.');
        }
        let bytes = 0;
        const bounded = response.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              bytes += chunk.byteLength;
              if (bytes > MAX_BYTES)
                throw new ProviderError('Jev response exceeded the size limit.');
              controller.enqueue(chunk);
            },
          }),
        );
        return new Response(bounded, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      },
    });
  }

  async evaluate(request: Pick<SystemOneRequest, 'state' | 'questions'>, signal: AbortSignal) {
    signal.throwIfAborted();
    if (Object.keys(request.questions).length > 24)
      throw new ProviderError('Too many Jev questions.');
    this.attempts++;
    try {
      const result = responseSchema.parse(
        await this.client.systemOne({ ...request, model: this.model }, { signal }),
      );
      signal.throwIfAborted();
      if (!sameKeys(result.answers, request.questions)) throw new Error('Mismatched answer keys');
      for (const [id, question] of Object.entries(request.questions)) {
        const answer = result.answers[id];
        if (question.type !== answer.type) throw new Error('Mismatched answer type');
        if (answer.type === 'noul') continue;
        if (question.type !== 'choice' && question.type !== 'score')
          throw new Error('Unsupported question type');
        const criteria = question.criteria;
        const labels = Object.keys(criteria);
        if (!sameKeys(answer.probabilities, criteria))
          throw new Error('Invalid probability labels');
        const bounds = distributionBounds(answer.probabilities);
        if (answer.type === 'choice' && !labels.includes(answer.choice))
          throw new Error('Unknown choice');
        if (answer.type === 'score') {
          if (
            answer.score > labels.length - 1 ||
            answer.score < bounds.minimumScore() - HALF_UNIT - EPSILON ||
            answer.score > bounds.maximumScore() + HALF_UNIT + EPSILON
          )
            throw new Error('Invalid expected score');
        }
      }
      this.successful++;
      if (this.observedModels.size < 8) this.observedModels.add(result.model);
      this.inputTokens =
        this.inputTokens === null || result.usage.input_tokens === null
          ? null
          : this.inputTokens + result.usage.input_tokens;
      this.outputTokens =
        this.outputTokens === null || result.usage.output_tokens === null
          ? null
          : this.outputTokens + result.usage.output_tokens;
      return result;
    } catch {
      signal.throwIfAborted();
      throw new ProviderError('Jev evaluation is unavailable or returned invalid typed answers.');
    }
  }

  metrics() {
    return {
      attemptedRequests: this.attempts,
      successfulRequests: this.successful,
      requestedModel: this.model,
      observedModels: [...this.observedModels],
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
    };
  }
}
