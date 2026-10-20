import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { discoveryRequestSchema } from '@hk/contracts';
import type { DiscoverySearch } from './discovery';

/** Off by default until a configured provider passes the small evaluation. */
export function discoveryRoutes(service?: DiscoverySearch, now = Date.now) {
  const app = new Hono();
  let active = 0,
    windowAt = now(),
    requests = 0;
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.get('/status', (c) => c.json({ experimental: true, enabled: !!service }));
  app.post(
    '/',
    bodyLimit({
      maxSize: 4096,
      onError: (c) => c.json({ error: 'Search evaluation request is too large.' }, 413),
    }),
    async (c) => {
      if (!service)
        return c.json(
          { error: 'Search evaluation is not enabled. Standard place search is available.' },
          503,
        );
      const parsed = discoveryRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success)
        return c.json(
          { error: 'Enter a request of 1–500 characters and a supported Hong Kong map reference.' },
          400,
        );
      if (now() - windowAt >= 60000) {
        windowAt = now();
        requests = 0;
      }
      if (active >= 2 || ++requests > 10) {
        c.header('Retry-After', '60');
        return c.json({ error: 'Search evaluation is busy. Try again shortly.' }, 429);
      }
      active++;
      try {
        return c.json(await service.search(parsed.data, c.req.raw.signal));
      } catch {
        return c.json(
          {
            error: 'Search interpretation is unavailable. Use standard place search or try again.',
          },
          502,
        );
      } finally {
        active--;
      }
    },
  );
  return app;
}
