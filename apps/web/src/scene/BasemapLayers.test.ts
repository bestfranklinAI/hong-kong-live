import { describe, expect, it, vi } from 'vitest';
import {
  Event,
  type ImageryLayer,
  type ImageryLayerCollection,
  type ImageryProvider,
} from 'cesium';
import { BasemapLayers } from './BasemapLayers';
import { basemapLayerDefinitions, type Basemap, type MapLanguage } from './basemaps';

vi.mock('cesium', async (original) => ({
  ...(await original<typeof import('cesium')>()),
  ImageryLayer: class {
    constructor(public imageryProvider: ImageryProvider) {}
  },
}));

function setup() {
  const layers: ImageryLayer[] = [];
  const collection = {
    add: vi.fn((layer: ImageryLayer, index: number) => layers.splice(index, 0, layer)),
    remove: vi.fn((layer: ImageryLayer) => layers.splice(layers.indexOf(layer), 1)),
  };
  const error = vi.fn();
  const stack = new BasemapLayers(collection as unknown as ImageryLayerCollection, error);
  const definitions = (basemap: Basemap | 'none', language: MapLanguage) =>
    basemapLayerDefinitions(basemap, language).map((definition) => ({
      key: definition.key,
      create: vi.fn(() => ({ errorEvent: new Event() }) as ImageryProvider),
    }));
  return { layers, collection, stack, error, definitions };
}

describe('basemap resource ownership', () => {
  it('harmonises retained and replacement layers in clean 3D and restores their original colour', () => {
    const { stack, definitions, layers, collection } = setup();
    stack.update(definitions('landsd-map', 'en'));
    const background = layers[1];
    stack.setMuted(true);
    expect(background.saturation).toBe(0.18);
    stack.update(definitions('landsd-map', 'tc'));
    expect(layers[1]).toBe(background);
    expect(layers[2].saturation).toBe(0.18);
    stack.setMuted(false);
    expect(
      layers.every(
        (layer) => layer.saturation === 1 && layer.contrast === 1 && layer.brightness === 1,
      ),
    ).toBe(true);
    expect(collection.remove).toHaveBeenCalledTimes(1);
  });
  it('changes only labels when language changes, retaining the background layer identity', () => {
    const { stack, definitions, layers, collection } = setup();
    stack.update(definitions('landsd-map', 'en'));
    const [neutral, background, labels] = layers;
    const next = definitions('landsd-map', 'tc');
    stack.update(next);
    expect(layers[0]).toBe(neutral);
    expect(layers[1]).toBe(background);
    expect(layers[2]).not.toBe(labels);
    expect(next[0].create).not.toHaveBeenCalled();
    expect(next[1].create).not.toHaveBeenCalled();
    expect(collection.remove).toHaveBeenCalledExactlyOnceWith(labels, true);
  });

  it('repeated identical updates do not allocate resources', () => {
    const { stack, definitions, collection } = setup();
    stack.update(definitions('landsd-aerial', 'tc'));
    stack.update(definitions('landsd-aerial', 'tc'));
    expect(collection.add).toHaveBeenCalledTimes(3);
    expect(collection.remove).not.toHaveBeenCalled();
  });

  it('detaches replaced listeners but retains errors from unchanged background layers', () => {
    const { stack, definitions, layers, error } = setup();
    stack.update(definitions('landsd-map', 'en'));
    const oldLabels = layers[2].imageryProvider.errorEvent;
    layers[1].imageryProvider.errorEvent.raiseEvent({});
    expect(stack.hasErrors).toBe(true);
    stack.update(definitions('landsd-map', 'tc'));
    oldLabels.raiseEvent({});
    expect(error).toHaveBeenCalledTimes(1);
    expect(stack.hasErrors).toBe(true);
    stack.update(definitions('openstreetmap', 'tc'));
    expect(stack.hasErrors).toBe(false);
    expect(layers).toHaveLength(1);
  });

  it('hides draped labels for navigation while retaining their resources and choice across replacements', () => {
    const { stack, definitions, layers, collection } = setup();
    stack.update(definitions('landsd-map', 'en'));
    const labels = layers[2];
    stack.setLabelVisibility(false);
    expect(labels.show).toBe(false);
    stack.setLabelVisibility(true);
    expect(layers[2]).toBe(labels);
    expect(labels.show).toBe(true);
    expect(collection.remove).not.toHaveBeenCalled();
    stack.setLabelVisibility(false);
    stack.update(definitions('landsd-map', 'tc'));
    expect(layers[2].show).toBe(false);
  });

  it('none mode and disposal release all layer resources, and disposal is repeatable', () => {
    const { stack, definitions, layers, collection } = setup();
    stack.update(definitions('landsd-map', 'en'));
    stack.update(definitions('none', 'en'));
    expect(layers).toHaveLength(0);
    expect(collection.remove).toHaveBeenCalledTimes(3);
    stack.dispose();
    stack.dispose();
    expect(collection.remove).toHaveBeenCalledTimes(3);
  });
});
