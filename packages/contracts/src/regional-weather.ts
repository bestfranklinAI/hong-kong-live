import { z } from 'zod';
export const regionalObservationSchema = z.object({
  station: z.string().min(1),
  temperature: z.number().finite().nullable(),
  temperatureAt: z.iso.datetime().nullable(),
  humidity: z.number().min(0).max(100).nullable(),
  humidityAt: z.iso.datetime().nullable(),
});
export const regionalWeatherSchema = z.array(regionalObservationSchema).max(100);
export type RegionalObservation = z.infer<typeof regionalObservationSchema>;
