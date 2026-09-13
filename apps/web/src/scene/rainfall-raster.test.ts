import { expect, it } from 'vitest';
import { sampleRainfall, rainfallRaster } from './rainfall-raster';
import { smoothRainfallColor } from '../features/live/rainfall-colors';

it('interpolates amounts without changing source samples or orientation', () => {
  const values = [0, 10, 20, 30];
  expect(sampleRainfall(values, 2, 2, 0.5, 0.5)).toBe(15);
  expect(sampleRainfall(values, 2, 2, 1, 0)).toBe(10);
  expect(sampleRainfall(values, 2, 2, -0.4, -0.4)).toBe(0);
  expect(values).toEqual([0, 10, 20, 30]);
});
it('does not interpolate across unknown data', () => {
  expect(sampleRainfall([0, null, 20, 30], 2, 2, 0.5, 0.5)).toBeNull();
  expect(sampleRainfall([0, null, 20, 30], 2, 2, 0, 0)).toBe(0);
});
it('keeps dry regions transparent and smooths low-rain boundaries', () => {
  const raster = rainfallRaster([0, 0, 0, 0], 2, 2, 'smooth');
  expect(raster.width).toBe(8);
  expect(raster.pixels.every((value) => value === 0)).toBe(true);
  expect(smoothRainfallColor(0.01)[3]).toBeLessThan(smoothRainfallColor(1)[3]);
  expect(rainfallRaster([0, 1, 5, 20], 2, 2, 'grid').width).toBe(2);
});
