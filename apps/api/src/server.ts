import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { fileURLToPath } from 'node:url';
import { RestaurantStore } from './search/store';
import { LandsdSearch } from './search/landsd';
import { startRestaurantCollector } from './search/collector';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { persistentFacilities } from './search/facility-storage';
import { FacilityCatalogue } from '@hk/providers';

// Some HK providers fail with Node's short address-family connection window.
// Keep TLS verification and request deadlines; allow a viable address to connect.
setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamilyAttemptTimeout(5000);

const mode = process.env.HK_DATA_MODE ?? 'live';
if (mode !== 'fixture' && mode !== 'live') throw new Error('HK_DATA_MODE must be live or fixture.');
const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a valid TCP port.');

const store = new RestaurantStore(
  mode === 'fixture'
    ? ':memory:'
    : (process.env.HK_SEARCH_DB ??
        fileURLToPath(new URL('../../../.data/search.sqlite', import.meta.url))),
);
const landsd = new LandsdSearch(fetch);
const stopCollector = mode === 'live' ? startRestaurantCollector(store, landsd, fetch) : () => {};
const facilities =
  mode === 'live'
    ? await persistentFacilities(
        process.env.HK_FACILITIES_DIR ??
          fileURLToPath(new URL('../../../.data/facilities', import.meta.url)),
        fetch,
      )
    : new FacilityCatalogue(fetch);
if (mode === 'live') void facilities.refresh();
const facilityTimer =
  mode === 'live' ? setInterval(() => void facilities.refresh(), 3600000) : undefined;
facilityTimer?.unref();
const app = createApp({ mode, searchRepository: store, landsd, facilities });
const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
console.info(`HK Live API listening on http://127.0.0.1:${port} (${mode} data)`);
if (mode === 'fixture')
  console.info('Recorded September 13, 2026 responses; timestamps are preserved and may be stale.');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopCollector();
    clearInterval(facilityTimer);
    facilities.dispose();
    server.close();
  });
}
