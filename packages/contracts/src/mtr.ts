import { z } from 'zod';
import network from './mtr-network.json';
import locations from './mtr-locations.json';

/** LandsD station reference points, not entrance or platform coordinates. */
export const mtrStationLocations: Readonly<Record<string, { lng: number; lat: number }>> =
  locations.stations;

/** MTR station CSV + Next Train dictionary v1.7, verified 2026-09-13. See docs/data/mtr.md. */
export const mtrLines = network.lines;
export const mtrStations: Readonly<Record<string, { name: string; nameZh: string }>> =
  network.stations;
export const stationSelectionSchema = z
  .object({
    line: z.string().regex(/^[A-Z]{3}$/),
    station: z.string().regex(/^[A-Z]{3}$/),
  })
  .refine(
    ({ line, station }) =>
      mtrLines.some((item) => item.code === line && item.stations.includes(station)),
    {
      message: 'Choose a station served by this supported MTR line.',
    },
  );
export type StationSelection = z.infer<typeof stationSelectionSchema>;
