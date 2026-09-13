import { expect, it } from 'vitest';
import { mtrLines, mtrStations, mtrStationLocations, stationSelectionSchema } from './mtr';
it('covers every documented line with consistent station names and validation', () => {
  expect(mtrLines.map((line) => line.code).sort()).toEqual([
    'AEL',
    'DRL',
    'EAL',
    'ISL',
    'KTL',
    'SIL',
    'TCL',
    'TKL',
    'TML',
    'TWL',
  ]);
  expect(Object.keys(mtrStations)).toHaveLength(98);
  for (const line of mtrLines) {
    expect(new Set(line.stations).size).toBe(line.stations.length);
    for (const station of line.stations) {
      expect(mtrStations[station]?.nameZh).toBeTruthy();
      expect(stationSelectionSchema.safeParse({ line: line.code, station }).success).toBe(true);
    }
  }
  expect(stationSelectionSchema.safeParse({ line: 'EAL', station: 'TST' }).success).toBe(false);
  expect(stationSelectionSchema.safeParse({ line: 'LRL', station: '001' }).success).toBe(false);
});

it('provides a geographic reference point for every supported station without merging interchanges', () => {
  expect(Object.keys(mtrStationLocations).sort()).toEqual(Object.keys(mtrStations).sort());
  for (const point of Object.values(mtrStationLocations)) {
    expect(point.lng).toBeGreaterThan(113.8);
    expect(point.lng).toBeLessThan(114.5);
    expect(point.lat).toBeGreaterThan(22.1);
    expect(point.lat).toBeLessThan(22.6);
  }
  // Independent LandsD transformation API check of the Sha Tin source point.
  expect(mtrStationLocations.SHT.lng).toBeCloseTo(114.186914844, 5);
  expect(mtrStationLocations.SHT.lat).toBeCloseTo(22.382126051, 5);
  expect(mtrStationLocations.CEN).not.toEqual(mtrStationLocations.HOK);
  expect(mtrStationLocations.TST).not.toEqual(mtrStationLocations.ETS);
});
