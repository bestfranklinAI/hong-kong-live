import { cameraCatalogueSchema } from '@hk/contracts';
import { ProviderError, type Fetcher } from './http';

export const CAMERA_SOURCE_URL =
  'https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.csv';
const MAX_BYTES = 1024 * 1024;
const HEADER = 'key\tregion\tdistrict\tdescription\teasting\tnorthing\tlatitude\tlongitude\turl';

/** The official .csv is currently BOM-marked UTF-16LE, tab-delimited, not comma-delimited. */
export function normalizeCameras(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_BYTES)
    throw new ProviderError('Camera catalogue exceeded the size limit.');
  const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : 'utf-8';
  const text = new TextDecoder(encoding, { fatal: true })
    .decode(bytes)
    .replace(/^\uFEFF+/, '')
    .trim();
  const rows = text.split(/\r?\n/);
  if (rows.shift() !== HEADER || rows.length > 2000)
    throw new ProviderError('Camera catalogue format changed.');
  const cameras = rows.map((line) => {
    const fields = line.split('\t');
    if (fields.length !== 9 || fields[6].trim() === '' || fields[7].trim() === '')
      throw new ProviderError('Invalid camera location.');
    const [id, region, district, name, , , lat, lng, imageUrl] = fields;
    // Some official catalogue IDs point to a differently named image. Preserve that mapping;
    // the shared schema restricts every URL to the fixed government image host.
    return { id, region, district, name, lat: Number(lat), lng: Number(lng), imageUrl };
  });
  const parsed = cameraCatalogueSchema.safeParse(cameras);
  if (!parsed.success || new Set(cameras.map((camera) => camera.id)).size !== cameras.length)
    throw new ProviderError('Invalid or duplicate cameras in catalogue.');
  // The catalogue provides locations, not a per-camera capture time.
  return { data: parsed.data, sourceUpdatedAt: null };
}

export async function fetchCameras(fetcher: Fetcher) {
  const response = await fetcher(CAMERA_SOURCE_URL, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.body)
    throw new ProviderError('Camera catalogue unavailable.', 60_000);
  if (Number(response.headers.get('content-length')) > MAX_BYTES)
    throw new ProviderError('Camera catalogue exceeded the size limit.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new ProviderError('Camera catalogue exceeded the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return normalizeCameras(bytes);
}
