import { expect, it } from 'vitest';
import { fetchCameras, normalizeCameras } from './cameras';
const header = 'key\tregion\tdistrict\tdescription\teasting\tnorthing\tlatitude\tlongitude\turl';
const row =
  'H429F\tHong Kong Island\tSouthern\tAberdeen Praya Road near Fish Market [H429F]\t833549.0\t812187.0\t22.24845\t114.1505\thttps://tdcctv.data.one.gov.hk/H429F.JPG';
const text = `${header}\r\n${row}\r\n`;
it('decodes the official UTF-16LE tab-separated format without inventing capture times', () => {
  const result = normalizeCameras(Buffer.from(`\uFEFF\uFEFF${text}`, 'utf16le'));
  expect(result.data[0]).toMatchObject({ id: 'H429F', lat: 22.24845, lng: 114.1505 });
  expect(result.sourceUpdatedAt).toBeNull();
});
it('also accepts UTF-8 and rejects unexpected schema, links and duplicate IDs', () => {
  const encode = (s: string) => new TextEncoder().encode(s);
  expect(normalizeCameras(encode(text)).data).toHaveLength(1);
  for (const invalid of [
    text.replace('key', 'code'),
    text.replace('https://tdcctv.data.one.gov.hk', 'https://example.org'),
    text + row,
    text.replace('22.24845', ''),
    text.replace('22.24845', '0'),
  ])
    expect(() => normalizeCameras(encode(invalid))).toThrow();
});
it('bounds catalogue downloads and propagates outages', async () => {
  await expect(
    fetchCameras(async () => new Response('x', { headers: { 'content-length': '2000000' } })),
  ).rejects.toThrow('size limit');
  await expect(fetchCameras(async () => new Response('', { status: 503 }))).rejects.toThrow(
    'unavailable',
  );
});
