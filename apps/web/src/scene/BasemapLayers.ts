import { ImageryLayer, type ImageryLayerCollection } from 'cesium';
import type { BasemapLayerDefinition } from './basemaps';

interface Entry {
  layer: ImageryLayer;
  unsubscribe: () => void;
  failed: boolean;
}

/** Retain unchanged layers and their GPU resources. Replaced layers never stay hidden in memory. */
export class BasemapLayers {
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
      this.entries.set(definition.key, entry);
      this.collection.add(entry.layer, index);
    });
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
