import { walkingRouteSchema, type RouteRequest } from '@hk/contracts';

export async function requestWalkingRoute(request: RouteRequest, cancellation: AbortSignal) {
  const timeout = AbortSignal.timeout(45000);
  const signal = AbortSignal.any([cancellation, timeout]);
  try {
    const response = await fetch('/api/v1/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
    const data = await response.json().catch(() => {
      throw new Error('Route response unavailable. Try again.');
    });
    signal.throwIfAborted();
    if (!response.ok)
      throw new Error(
        typeof data?.error === 'string' ? data.error : 'Route unavailable. Try again.',
      );
    const result = walkingRouteSchema.safeParse(data);
    if (!result.success) throw new Error('Route response unavailable. Try again.');
    if (
      result.data.request.profile !== request.profile ||
      result.data.request.language !== request.language ||
      !!result.data.request.preferences?.preferCover !== !!request.preferences?.preferCover
    )
      throw new Error(
        'The route response does not match the requested profile or language. Try again.',
      );
    return result.data;
  } catch (error) {
    if (!cancellation.aborted && timeout.aborted)
      throw new Error('Route request timed out. Try again.');
    throw error;
  }
}
