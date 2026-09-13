import { rainfallColor, smoothRainfallColor } from '../features/live/rainfall-colors';

export type RainfallStyle = 'smooth' | 'grid';

/** Interpolate amounts before colouring; missing samples never become dry or inferred rain. */
export function sampleRainfall(
  values: (number | null)[],
  width: number,
  height: number,
  x: number,
  y: number,
): number | null {
  const cx = Math.max(0, Math.min(width - 1, x));
  const cy = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(cx),
    y0 = Math.floor(cy);
  const tx = cx - x0,
    ty = cy - y0;
  const samples = [
    [values[y0 * width + x0], (1 - tx) * (1 - ty)],
    [values[y0 * width + Math.min(x0 + 1, width - 1)], tx * (1 - ty)],
    [values[Math.min(y0 + 1, height - 1) * width + x0], (1 - tx) * ty],
    [values[Math.min(y0 + 1, height - 1) * width + Math.min(x0 + 1, width - 1)], tx * ty],
  ];
  let amount = 0;
  for (const [value, weight] of samples) {
    if (!weight) continue;
    if (value === null || value === undefined) return null;
    amount += value * weight;
  }
  return amount;
}

export function rainfallRaster(
  values: (number | null)[],
  width: number,
  height: number,
  style: RainfallStyle,
) {
  const scale = style === 'smooth' ? 4 : 1;
  const rasterWidth = width * scale,
    rasterHeight = height * scale;
  const pixels = new Uint8ClampedArray(rasterWidth * rasterHeight * 4);
  for (let y = 0; y < rasterHeight; y++)
    for (let x = 0; x < rasterWidth; x++) {
      // Centre alignment keeps the source cell-edge rectangle unchanged when upsampling.
      const value =
        style === 'smooth'
          ? sampleRainfall(values, width, height, (x + 0.5) / scale - 0.5, (y + 0.5) / scale - 0.5)
          : values[y * width + x];
      pixels.set(
        style === 'smooth' ? smoothRainfallColor(value) : rainfallColor(value),
        (y * rasterWidth + x) * 4,
      );
    }
  return { width: rasterWidth, height: rasterHeight, pixels };
}
