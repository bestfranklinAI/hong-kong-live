import { expect, it, vi } from 'vitest';
import { PbfWriter } from 'pbf';
import { decodeMapLabels, LandsdMapLabels } from './map-labels';
import type { Fetcher } from './http';
function tile(name = 'BuildingLabels_EN:1', text = 'Example building') {
  const writer = new PbfWriter();
  writer.writeMessage(
    3,
    (_, layer) => {
      layer.writeStringField(1, name);
      layer.writeVarintField(15, 2);
      layer.writeVarintField(5, 4096);
      layer.writeStringField(3, '_name');
      layer.writeMessage(4, (_, value) => value.writeStringField(1, text), null);
      layer.writeMessage(
        2,
        (_, feature) => {
          feature.writePackedVarint(2, [0, 0]);
          feature.writeVarintField(3, 1);
          feature.writePackedVarint(4, [9, 4096, 4096]);
        },
        null,
      );
    },
    null,
  );
  return writer.finish();
}
it('decodes official name fields without treating house numbers or markup as labels', () => {
  const rows = decodeMapLabels(tile(), 26775, 14303, 15);
  expect(rows[0]).toMatchObject({ text: 'Example building', kind: 'building' });
  expect(rows[0]!.lng).toBeGreaterThan(114);
  expect(decodeMapLabels(tile('BuildingHouseNoPoint:1', '12'), 26775, 14303, 15)).toEqual([]);
  expect(
    decodeMapLabels(tile('StreetCentreLines:1/label', '<FNT>QUEENSWAY</FNT>'), 26775, 14303, 15)[0]
      ?.text,
  ).toBe('QUEENSWAY');
});
it('uses a fixed bounded source, caches successful tiles and rejects invalid requests', async () => {
  const fetcher = vi.fn<Fetcher>(async () => new Response(Uint8Array.from(tile())));
  const client = new LandsdMapLabels(fetcher);
  const signal = new AbortController().signal;
  const first = await client.tile(15, 26775, 14303, 'en', signal);
  expect(await client.tile(15, 26775, 14303, 'en', signal)).toBe(first);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/vt/label/hk/en/WGS84/tile/15/14303/26775.pbf',
  );
  await expect(client.tile(20, 0, 0, 'en', signal)).rejects.toThrow('Invalid label tile');
  const oversized = new LandsdMapLabels(
    async () => new Response(new Uint8Array(1), { headers: { 'content-length': '3000000' } }),
  );
  await expect(oversized.tile(15, 26775, 14303, 'en', signal)).rejects.toThrow('size');
});
