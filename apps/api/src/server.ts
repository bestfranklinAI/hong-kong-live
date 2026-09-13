import { serve } from '@hono/node-server';
import { createApp } from './app';

const mode = process.env.HK_DATA_MODE ?? 'live';
if (mode !== 'fixture' && mode !== 'live') throw new Error('HK_DATA_MODE must be live or fixture.');
const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a valid TCP port.');

const app = createApp({ mode });
const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
console.info(`HK Live API listening on http://127.0.0.1:${port} (${mode} data)`);
if (mode === 'fixture')
  console.info('Recorded September 13, 2026 responses; timestamps are preserved and may be stale.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close());
}
