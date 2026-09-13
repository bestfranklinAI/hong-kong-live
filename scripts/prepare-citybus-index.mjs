import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
const base = 'https://rt.data.gov.hk/v2/transport/citybus';
const cache = new URL('../output/citybus-index/', import.meta.url);
await mkdir(cache, { recursive: true });
async function read(path) {
  const file = new URL(path.replaceAll('/', '_') + '.json', cache);
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - Date.parse(saved.generated_timestamp) < 86400000) return saved;
  } catch {
    /* Resume successful downloads. */
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(base + path, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      const value = await response.json();
      if (!Array.isArray(value.data) && !value.data?.stop) throw new Error(`Invalid ${path}`);
      await writeFile(file, JSON.stringify(value));
      return value;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
async function map(items, work) {
  let next = 0,
    done = 0;
  const results = new Array(items.length);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await work(items[i]);
        done++;
        if (done % 100 === 0) console.log(`${done}/${items.length}`);
      }
    }),
  );
  return results;
}
const routes = await read('/route/CTB');
if (
  !routes.data.length ||
  routes.data.length > 2500 ||
  new Set(routes.data.map((r) => r.route)).size !== routes.data.length
)
  throw new Error('Invalid route catalogue');
const queries = routes.data.flatMap((r) =>
  ['outbound', 'inbound'].map((direction) => ({ route: r.route, direction })),
);
console.log(`Loading ${queries.length} route directions`);
const sequences = await map(queries, async (q) => {
  if (!/^[A-Z0-9]{1,8}$/.test(q.route)) throw new Error('Invalid route');
  const source = await read(`/route-stop/CTB/${q.route}/${q.direction}`);
  const rows = source.data.sort((a, b) => a.seq - b.seq);
  if (
    rows.length > 200 ||
    rows.some(
      (r, i) =>
        r.co !== 'CTB' ||
        r.route !== q.route ||
        r.dir !== (q.direction === 'outbound' ? 'O' : 'I') ||
        r.seq !== i + 1 ||
        !/^\d{6}$/.test(r.stop),
    )
  )
    throw new Error('Invalid sequence');
  return source;
});
const ids = [...new Set(sequences.flatMap((s) => s.data.map((r) => r.stop)))].sort();
if (!ids.length || ids.length > 10000) throw new Error('Invalid stop catalogue size');
console.log(`Loading ${ids.length} stop details`);
const details = await map(ids, async (id) => {
  const source = await read(`/stop/${id}`);
  const s = source.data;
  const lng = Number(s.long),
    lat = Number(s.lat);
  if (
    s.stop !== id ||
    !s.name_en ||
    !s.name_tc ||
    !(lng >= 113.8 && lng <= 114.5 && lat >= 22.1 && lat <= 22.6)
  )
    throw new Error(`Invalid stop ${id}`);
  return { id, name: s.name_en, nameZh: s.name_tc, lng, lat };
});
const memberships = {};
for (const source of sequences)
  for (const r of source.data)
    (memberships[r.stop] ??= []).push({ route: r.route, bound: r.dir, service: '1', seq: r.seq });
const result = {
  generatedAt: new Date().toISOString(),
  sourceUrl: base,
  sourceRetrievedFrom: routes.generated_timestamp,
  routeCount: routes.data.length,
  stops: details,
  memberships,
};
const target = new URL('../apps/api/src/data/citybus-index.json', import.meta.url);
await mkdir(new URL('./', target), { recursive: true });
await writeFile(new URL(target.href + '.tmp'), JSON.stringify(result));
await rename(new URL(target.href + '.tmp'), target);
console.log(`Published ${details.length} stops`);
