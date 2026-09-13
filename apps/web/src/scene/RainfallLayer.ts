import {
  ImageryLayer,
  Rectangle,
  SingleTileImageryProvider,
  TextureMagnificationFilter,
  TextureMinificationFilter,
  type CesiumWidget,
} from 'cesium';
import type { Rainfall } from '@hk/contracts';
import { rainfallRaster, type RainfallStyle } from './rainfall-raster';

export interface RainfallSelection {
  publication: Rainfall;
  index: number;
  style: RainfallStyle;
}

/** At most three small raster textures; no per-cell entities or frame loop. */
export class RainfallLayer {
  private layers = new Map<string, ImageryLayer>();
  constructor(private readonly widget: CesiumWidget) {}

  set(selection: RainfallSelection | null) {
    if (!selection) {
      this.dispose();
      return;
    }
    const { publication, index, style } = selection;
    const wanted = new Set<string>();
    for (let i = Math.max(0, index - 1); i <= Math.min(3, index + 1); i++) {
      const key = `${publication.revision}:${style}:${i}`;
      wanted.add(key);
      let layer = this.layers.get(key);
      if (!layer) {
        const canvas = document.createElement('canvas');
        const raster = rainfallRaster(
          publication.frames[i].values,
          publication.width,
          publication.height,
          style,
        );
        canvas.width = raster.width;
        canvas.height = raster.height;
        const context = canvas.getContext('2d');
        if (!context) continue;
        const pixels = context.createImageData(canvas.width, canvas.height);
        pixels.data.set(raster.pixels);
        context.putImageData(pixels, 0, 0);
        layer = new ImageryLayer(
          new SingleTileImageryProvider({
            url: canvas.toDataURL('image/png'),
            rectangle: Rectangle.fromDegrees(...publication.bounds),
            tileWidth: canvas.width,
            tileHeight: canvas.height,
            credit: 'Rainfall forecast: Hong Kong Observatory',
          }),
          {
            minificationFilter:
              style === 'smooth'
                ? TextureMinificationFilter.LINEAR
                : TextureMinificationFilter.NEAREST,
            magnificationFilter:
              style === 'smooth'
                ? TextureMagnificationFilter.LINEAR
                : TextureMagnificationFilter.NEAREST,
          },
        );
        this.widget.imageryLayers.add(layer);
        this.layers.set(key, layer);
      }
      layer.show = i === index;
    }
    for (const [key, layer] of this.layers) {
      if (!wanted.has(key)) {
        this.widget.imageryLayers.remove(layer, true);
        this.layers.delete(key);
      }
    }
    this.widget.scene.requestRender();
  }

  dispose() {
    for (const layer of this.layers.values()) this.widget.imageryLayers.remove(layer, true);
    this.layers.clear();
    this.widget.scene.requestRender();
  }
}
