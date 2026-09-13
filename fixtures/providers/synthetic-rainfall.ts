// Synthetic grid, never served as live data. Distinct corners catch inverted raster axes.
export function syntheticRainfall() {
  const rows = [
    'Updated Date and Time (in Hong Kong Time),Ending Date and Time (in Hong Kong Time),Latitude (degree),Longitude (degree),Half-hourly Nowcast Accumulated Rainfall (mm)',
  ];
  for (const end of ['1230', '1300', '1330', '1400']) {
    for (let y = 0; y < 121; y++)
      for (let x = 0; x < 121; x++)
        rows.push(
          `202609131200,20260913${end},${(23 - y * 0.01).toFixed(3)},${(113 + x * 0.01).toFixed(3)},${x === 0 && y === 0 ? '12.34' : '0.00'}`,
        );
  }
  return rows.join('\n');
}
