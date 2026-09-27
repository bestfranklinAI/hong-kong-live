import { indoorStationSchema } from '@hk/contracts';
import { IndoorCatalogue } from '@hk/providers';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { routeRequestSchema, type DataMode } from '@hk/contracts';
import { WalkingRouter, ProviderError, type Fetcher } from '@hk/providers';
export function routingRoutes(fetcher: Fetcher, now: () => number, mode: DataMode) {
  const app = new Hono(),
    router = new WalkingRouter(fetcher, now);
  const indoor = new IndoorCatalogue(fetcher, now);
  let windowAt = now(),
    requests = 0;
  app.use(
    '*',
    bodyLimit({
      maxSize: 8192,
      onError: (c) => c.json({ error: 'Route request is too large.' }, 413),
    }),
  );
  app.use('*', async (c, next) => {
    if (mode === 'fixture')
      return c.json(
        { error: 'Walking routes and indoor points are unavailable in fixture mode.' },
        503,
      );
    if (now() - windowAt >= 60000) {
      windowAt = now();
      requests = 0;
    }
    if (++requests > 30)
      return c.json({ error: 'Too many route requests. Try again in a minute.' }, 429);
    await next();
  });
  app.get('/indoor/stations', async (c) => {
    try {
      return c.json(await indoor.stations());
    } catch {
      return c.json({ error: 'Indoor station catalogue is unavailable. Try again.' }, 502);
    }
  });
  app.get('/indoor/stations/:id/points', async (c) => {
    const id = indoorStationSchema.shape.id.safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'Choose a valid station.' }, 400);
    try {
      return c.json(await indoor.points(id.data));
    } catch {
      return c.json({ error: 'Indoor points are unavailable. Try again.' }, 502);
    }
  });
  app.get('/indoor/stations/:id/floors', async (c) => {
    const id = indoorStationSchema.shape.id.safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'Choose a valid station.' }, 400);
    try {
      return c.json(await indoor.floors(id.data));
    } catch {
      return c.json({ error: 'Indoor floor outlines are unavailable. Try again.' }, 502);
    }
  });
  app.get('/indoor/stations/:id/layout', async (c) => {
    const id = indoorStationSchema.shape.id.safeParse(c.req.param('id'));
    if (!id.success) return c.json({ error: 'Choose a valid station.' }, 400);
    try {
      return c.json(await indoor.layout(id.data));
    } catch {
      return c.json({ error: 'Station layout is unavailable. Try again.' }, 502);
    }
  });
  app.post('/', async (c) => {
    const parsed = routeRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return c.json({ error: 'Choose valid start and destination points in Hong Kong.' }, 400);
    try {
      const [start, end] = await Promise.all([
        indoor.resolve(parsed.data.start),
        indoor.resolve(parsed.data.end),
      ]);
      return c.json(await router.route({ ...parsed.data, start, end }));
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof ProviderError
              ? error.message
              : 'Walking routes are temporarily unavailable. Please try again.',
        },
        502,
      );
    }
  });
  return app;
}
