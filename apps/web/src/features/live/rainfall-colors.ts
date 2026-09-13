/** Discrete half-hour totals in millimetres, not rainfall rates or warning levels. */
export const rainBands = [
  { min: 0.01, label: '0.01–<1', color: '#7cc8b6', rgb: [124, 200, 182] },
  { min: 1, label: '1–<5', color: '#258e9c', rgb: [37, 142, 156] },
  { min: 5, label: '5–<10', color: '#547fa8', rgb: [84, 127, 168] },
  { min: 10, label: '10–<20', color: '#927399', rgb: [146, 115, 153] },
  { min: 20, label: '20+', color: '#dc795c', rgb: [220, 121, 92] },
];
export function rainfallColor(value: number | null): number[] {
  if (value === null) return [100, 100, 100, 100];
  if (value === 0) return [0, 0, 0, 0];
  const band = [...rainBands].reverse().find((band) => value >= band.min) ?? rainBands[0];
  return [...band.rgb, 175];
}

/** Continuous colour ramp on a log scale; opacity tapers near zero rather than forming hard edges. */
export function smoothRainfallColor(value: number | null): number[] {
  if (value === null) return [100, 100, 100, 100];
  if (value <= 0) return [0, 0, 0, 0];
  let lower = rainBands[0];
  let upper = lower;
  for (const band of rainBands) {
    if (value >= band.min) lower = band;
    upper = band;
    if (value < band.min) break;
  }
  const t =
    upper.min === lower.min
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (Math.log1p(value) - Math.log1p(lower.min)) /
              (Math.log1p(upper.min) - Math.log1p(lower.min)),
          ),
        );
  const rgb = lower.rgb.map((channel, i) => Math.round(channel + (upper.rgb[i] - channel) * t));
  return [...rgb, Math.round(165 * (1 - Math.exp(-value / 0.18)))];
}
