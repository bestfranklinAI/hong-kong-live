import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { MapNameLabel } from '@hk/contracts';
import type { Fetcher } from './http';

const ROOT = 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/vt/label/hk';
const MAX_BYTES = 2 * 1024 * 1024;
function midpoint(line: number[][]): number[] | undefined {
  const lengths = line
    .slice(1)
    .map((p, i) => Math.hypot(p[0]! - line[i]![0]!, p[1]! - line[i]![1]!));
  let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (remaining <= length && length > 0) {
      const a = line[i]!,
        b = line[i + 1]!,
        t = remaining / length;
      return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t];
    }
    remaining -= length;
  }
  return line[0];
}
export function decodeMapLabels(
  bytes: Uint8Array,
  x: number,
  y: number,
  z: number,
): MapNameLabel[] {
  const tile = new VectorTile(new PbfReader(bytes));
  const labels = new Map<string, MapNameLabel>();
  let inspected = 0;
  for (const [name, layer] of Object.entries(tile.layers)) {
    const kind = /StreetCentreLines/i.test(name)
      ? 'street'
      : /^BuildingLabels_(EN|TC|Phase|Block)/i.test(name)
        ? 'building'
        : null;
    if (!kind) continue;
    for (let i = 0; i < layer.length && inspected++ < 6000; i++) {
      const feature = layer.feature(i);
      const raw = feature.properties._name;
      if (typeof raw !== 'string') continue;
      const text = raw
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text || text.length > 120 || /^\d+$/.test(text)) continue;
      const geometry = feature.toGeoJSON(x, y, z).geometry;
      const coordinate =
        geometry.type === 'Point'
          ? geometry.coordinates
          : geometry.type === 'LineString'
            ? midpoint(geometry.coordinates)
            : geometry.type === 'MultiLineString'
              ? midpoint([...geometry.coordinates].sort((a, b) => b.length - a.length)[0] ?? [])
              : undefined;
      if (!coordinate) continue;
      const [lng, lat] = coordinate;
      if (
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lng! < 113.8 ||
        lng! > 114.5 ||
        lat! < 22.1 ||
        lat! > 22.6
      )
        continue;
      const id = `${kind}:${text}:${lng!.toFixed(5)}:${lat!.toFixed(5)}`;
      labels.set(id, { id, text, kind, lng: lng!, lat: lat! });
      if (labels.size >= 400) return [...labels.values()];
    }
  }
  return [...labels.values()];
}

/** Fixed public source, bounded reads, short-lived LRU cache. No arbitrary URL forwarding. */
export class LandsdMapLabels {
  private cache = new Map<string, { at: number; rows: MapNameLabel[] }>();
  constructor(
    private fetcher: Fetcher = (url, init) => fetch(url, init),
    private now = Date.now,
  ) {}
  async tile(z: number, x: number, y: number, language: 'en' | 'tc', signal: AbortSignal) {
    if (
      ![z, x, y].every(Number.isInteger) ||
      z < 9 ||
      z > 15 ||
      x < 0 ||
      y < 0 ||
      x >= 2 ** z ||
      y >= 2 ** z ||
      !['en', 'tc'].includes(language)
    )
      throw new Error('Invalid label tile');
    const key = `${language}/${z}/${y}/${x}`;
    signal.throwIfAborted();
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.at < 15 * 60_000) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.rows;
    }
    const response = await this.fetcher(`${ROOT}/${language}/WGS84/tile/${z}/${y}/${x}.pbf`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
    if (!response.ok) throw new Error('Map names unavailable');
    let rows: MapNameLabel[] = [];
    if (response.status !== 204) {
      if (!response.body || Number(response.headers.get('content-length')) > MAX_BYTES)
        throw new Error('Invalid label tile size');
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            throw new Error('Label tile too large');
          }
          chunks.push(next.value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      rows = decodeMapLabels(bytes, x, y, z);
    }
    signal.throwIfAborted();
    this.cache.set(key, { at: this.now(), rows });
    while (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value!);
    return rows;
  }
}
