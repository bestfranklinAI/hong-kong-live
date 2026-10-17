import { ImageryLayer, type ImageryLayerCollection } from 'cesium';
import type { BasemapLayerDefinition } from './basemaps';

interface Entry {
  layer: ImageryLayer;
  unsubscribe: () => void;
  failed: boolean;
}

/** Retain unchanged layers and their GPU resources. Replaced layers never stay hidden in memory. */
export class BasemapLayers {
  private labelsVisible = true;
  private muted = false;
  private entries = new Map<string, Entry>();
  constructor(
    private collection: ImageryLayerCollection,
    private onError: () => void,
  ) {}

  get hasErrors() {
    return [...this.entries.values()].some((entry) => entry.failed);
  }

  update(definitions: BasemapLayerDefinition[]) {
    const keys = new Set(definitions.map((definition) => definition.key));
    for (const [key, entry] of this.entries) {
      if (!keys.has(key)) this.remove(key, entry);
    }
    definitions.forEach((definition, index) => {
      if (this.entries.has(definition.key)) return;
      const provider = definition.create();
      const entry: Entry = {
        layer: new ImageryLayer(provider),
        unsubscribe: () => {},
        failed: false,
      };
      entry.unsubscribe = provider.errorEvent.addEventListener(() => {
        if (entry.failed) return;
        entry.failed = true;
        this.onError();
      });
      if (definition.key.startsWith('labels:')) entry.layer.show = this.labelsVisible;
      this.style(entry.layer);
      this.entries.set(definition.key, entry);
      this.collection.add(entry.layer, index);
    });
  }

  setLabelVisibility(visible: boolean) {
    this.labelsVisible = visible;
    for (const [key, entry] of this.entries)
      if (key.startsWith('labels:')) entry.layer.show = visible;
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    for (const entry of this.entries.values()) this.style(entry.layer);
  }
  private style(layer: ImageryLayer) {
    // Keep the original raster and credits; only harmonise its colour beneath clean models.
    layer.saturation = this.muted ? 0.18 : 1;
    layer.contrast = this.muted ? 0.8 : 1;
    layer.brightness = this.muted ? 1.08 : 1;
  }

  private remove(key: string, entry: Entry) {
    entry.unsubscribe();
    this.collection.remove(entry.layer, true);
    this.entries.delete(key);
  }

  dispose() {
    for (const [key, entry] of this.entries) this.remove(key, entry);
  }
}
