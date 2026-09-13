import { rainfallSchema, type Rainfall } from '@hk/contracts';
import { ProviderError, type Fetcher } from './http';
import { parseSourceTime } from './time';

export const RAINFALL_SOURCE_URL =
  'https://data.weather.gov.hk/weatherAPI/hko_data/F3/Gridded_rainfall_nowcast.csv';
const HEADER =
  'Updated Date and Time (in Hong Kong Time),Ending Date and Time (in Hong Kong Time),Latitude (degree),Longitude (degree),Half-hourly Nowcast Accumulated Rainfall (mm)';
const LIMIT = 4 * 1024 * 1024;

function sourceTime(raw: string): string {
  if (!/^\d{12}$/.test(raw)) throw new ProviderError('Invalid rainfall time.');
  const value = parseSourceTime(
    `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}:00`,
  );
  if (!value) throw new ProviderError('Invalid rainfall calendar date.');
  return value;
}

/** Validate the complete publication before exposing any frame to clients. */
export async function normalizeRainfall(
  csv: string,
): Promise<{ data: Rainfall; sourceUpdatedAt: string }> {
  if (csv.length > LIMIT) throw new ProviderError('Rainfall response exceeded the size limit.');
  const lines = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/);
  if (lines.shift() !== HEADER || lines.length !== 4 * 121 * 121)
    throw new ProviderError('Incomplete or changed rainfall grid.');
  const rows = lines.map((line) => line.split(','));
  const issuedAt = sourceTime(rows[0][0]);
  const latitudes = [...new Set(rows.map((r) => Number(r[2])))].sort((a, b) => b - a);
  const longitudes = [...new Set(rows.map((r) => Number(r[3])))].sort((a, b) => a - b);
  const regular = (axis: number[], min: number, max: number) =>
    axis.length === 121 &&
    axis.every(
      (n, i) =>
        Number.isFinite(n) &&
        n >= min &&
        n <= max &&
        (!i || Math.abs(Math.abs(n - axis[i - 1]) - Math.abs(axis[120] - axis[0]) / 120) < 0.0011),
    );
  if (!regular(latitudes, 20, 25) || !regular(longitudes, 110, 118))
    throw new ProviderError('Unexpected rainfall coordinates.');
  const latIndex = new Map(latitudes.map((n, i) => [n, i]));
  const lonIndex = new Map(longitudes.map((n, i) => [n, i]));
  const frames = Array.from({ length: 4 }, (_, i) => ({
    startsAt: new Date(Date.parse(issuedAt) + i * 30 * 60_000).toISOString(),
    endsAt: new Date(Date.parse(issuedAt) + (i + 1) * 30 * 60_000).toISOString(),
    values: Array<number | null>(14641).fill(null),
  }));
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.length !== 5 || row[0] !== rows[0][0] || row[2].trim() === '' || row[3].trim() === '')
      throw new ProviderError('Mixed or malformed rainfall publication.');
    const end = sourceTime(row[1]);
    const frameIndex = frames.findIndex((frame) => frame.endsAt === end);
    const y = latIndex.get(Number(row[2]));
    const x = lonIndex.get(Number(row[3]));
    if (frameIndex < 0 || y === undefined || x === undefined)
      throw new ProviderError('Unexpected rainfall valid period or coordinate.');
    const key = `${frameIndex}:${y}:${x}`;
    if (seen.has(key)) throw new ProviderError('Duplicate rainfall grid cell.');
    seen.add(key);
    // No undocumented negative sentinel is interpreted as dry weather.
    const raw = row[4].trim();
    const amount = raw === '' ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0))
      throw new ProviderError('Invalid rainfall amount.');
    frames[frameIndex].values[y * 121 + x] = amount;
  }
  const dx = (longitudes[120] - longitudes[0]) / 120 / 2;
  const dy = (latitudes[0] - latitudes[120]) / 120 / 2;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(csv));
  const revision = [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
  const data = rainfallSchema.parse({
    revision,
    issuedAt,
    width: 121,
    height: 121,
    bounds: [longitudes[0] - dx, latitudes[120] - dy, longitudes[120] + dx, latitudes[0] + dy],
    frames,
  });
  return { data, sourceUpdatedAt: issuedAt };
}

export async function fetchRainfall(fetcher: Fetcher) {
  const response = await fetcher(RAINFALL_SOURCE_URL, {
    signal: AbortSignal.timeout(45_000),
    headers: { Accept: 'text/csv' },
  });
  if (!response.ok || !response.body)
    throw new ProviderError('Rainfall source unavailable.', 60_000);
  if (Number(response.headers.get('content-length')) > LIMIT)
    throw new ProviderError('Rainfall response exceeded the size limit.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > LIMIT) {
        await reader.cancel();
        throw new ProviderError('Rainfall response exceeded the size limit.');
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return normalizeRainfall(body);
}
