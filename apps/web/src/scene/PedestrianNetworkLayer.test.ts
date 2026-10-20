// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import {
  Cartographic,
  PrimitiveCollection,
  type CesiumWidget,
  type PointPrimitiveCollection,
} from 'cesium';
import type { PedestrianNetwork } from '@hk/contracts';
import { PedestrianNetworkLayer } from './PedestrianNetworkLayer';

it('keeps a vertical lift visible in ground projection and releases its geometry and markers', () => {
  const root = new PrimitiveCollection();
  const widget = { scene: { primitives: root, requestRender: vi.fn() } } as unknown as CesiumWidget;
  const data: PedestrianNetwork = {
    category: 'connections',
    corridorM: 50,
    partial: false,
    heightDatum: 'HKPD',
    fetchedAt: '2026-10-19T00:00:00Z',
    sourceUrl: 'https://example.com',
    segments: [
      {
        id: '1',
        kind: 'Lift',
        cover: 'covered',
        enabled: true,
        amendedAt: null,
        floorId: null,
        accessTimeId: null,
        paths: [
          [
            [114.16, 22.28, -12],
            [114.16, 22.28, 25],
          ],
        ],
      },
    ],
  };
  const layer = new PedestrianNetworkLayer(widget);
  layer.set(data);
  const markers = root.get(1) as PointPrimitiveCollection;
  expect(markers.length).toBe(1);
  expect(Cartographic.fromCartesian(markers.get(0).position).height).toBeCloseTo(2);
  layer.set(undefined);
  expect(markers.length).toBe(0);
  layer.set(data);
  layer.dispose();
  expect(root.length).toBe(0);
  expect(markers.isDestroyed()).toBe(true);
  root.destroy();
});
