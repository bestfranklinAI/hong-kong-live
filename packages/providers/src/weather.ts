import type { WeatherSummary } from '@hk/contracts';
import { z } from 'zod';
import { fetchJson, ProviderError, type Fetcher } from './http';
import { parseSourceTime } from './time';
import type { SourceResult } from './types';

export const WEATHER_SOURCE_URL =
  'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en';

const observationSchema = z.object({
  place: z.string(),
  value: z.number().finite(),
  unit: z.string(),
});
const observationGroupSchema = z.object({
  recordTime: z.string().optional(),
  data: z.array(observationSchema),
});
const reportSchema = z.object({
  updateTime: z.string(),
  temperature: observationGroupSchema,
  humidity: observationGroupSchema.optional(),
  icon: z.array(z.number().int()).optional(),
  iconUpdateTime: z.string().optional(),
});

// HKO's official icon descriptions. Unrecognised codes remain visibly unknown.
const CONDITIONS: Record<number, string> = {
  50: 'Sunny',
  51: 'Sunny periods',
  52: 'Sunny intervals',
  53: 'Sunny periods with showers',
  54: 'Sunny intervals with showers',
  60: 'Cloudy',
  61: 'Overcast',
  62: 'Light rain',
  63: 'Rain',
  64: 'Heavy rain',
  65: 'Thunderstorms',
  70: 'Fine',
  71: 'Fine',
  72: 'Fine',
  73: 'Fine',
  74: 'Fine',
  75: 'Fine',
  76: 'Mainly cloudy',
  77: 'Mainly fine',
  80: 'Windy',
  81: 'Dry',
  82: 'Humid',
  83: 'Fog',
  84: 'Mist',
  85: 'Haze',
  90: 'Hot',
  91: 'Warm',
  92: 'Cool',
  93: 'Cold',
};

export function normalizeWeather(input: unknown): SourceResult<WeatherSummary> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) throw new ProviderError('Weather source format has changed.');
  const report = parsed.data;
  const station = 'Hong Kong Observatory';
  const temperature = report.temperature.data.find(
    (item) => item.place === station && item.unit === 'C',
  );
  const humidity = report.humidity?.data.find(
    (item) => item.place === station && item.unit === 'percent',
  );
  if (!temperature) throw new ProviderError('The reference station temperature is unavailable.');
  const icon = report.icon?.[0] ?? null;
  // One envelope covers these displayed observations, so use the oldest relevant time.
  // The report publication time alone must not freshen older measurements/icons.
  const componentTimes = [parseSourceTime(report.temperature.recordTime)];
  if (humidity) componentTimes.push(parseSourceTime(report.humidity?.recordTime));
  if (icon !== null) componentTimes.push(parseSourceTime(report.iconUpdateTime));
  const sourceUpdatedAt = componentTimes.every((time): time is string => time !== null)
    ? (componentTimes.sort()[0] ?? null)
    : null;

  return {
    sourceUpdatedAt,
    data: {
      temperature: temperature.value,
      humidity: humidity?.value ?? null,
      icon,
      condition:
        icon === null ? 'Condition unavailable' : (CONDITIONS[icon] ?? 'Condition unavailable'),
      station,
      updatedAt: sourceUpdatedAt,
    },
  };
}

export async function fetchWeather(fetcher: Fetcher): Promise<SourceResult<WeatherSummary>> {
  return normalizeWeather(await fetchJson(WEATHER_SOURCE_URL, fetcher));
}

/** Match each metric by station; an Observatory humidity reading is never copied elsewhere. */
export function normalizeRegionalWeather(
  input: unknown,
): SourceResult<import('@hk/contracts').RegionalObservation[]> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) throw new ProviderError('Weather source format has changed.');
  const report = parsed.data;
  const temperatureAt = parseSourceTime(report.temperature.recordTime);
  const humidityAt = parseSourceTime(report.humidity?.recordTime);
  const temperatures = report.temperature.data.filter((item) => item.unit === 'C');
  if (
    !temperatures.length ||
    temperatures.length > 100 ||
    new Set(temperatures.map((item) => item.place)).size !== temperatures.length
  )
    throw new ProviderError('Regional temperature stations are unavailable or duplicated.');
  return {
    sourceUpdatedAt: temperatureAt,
    data: temperatures.map((item) => {
      const humidity = report.humidity?.data.find(
        (value) =>
          value.place === item.place &&
          value.unit === 'percent' &&
          value.value >= 0 &&
          value.value <= 100,
      );
      return {
        station: item.place,
        temperature: item.value,
        temperatureAt,
        humidity: humidity?.value ?? null,
        humidityAt: humidity ? humidityAt : null,
      };
    }),
  };
}

export async function fetchWeatherReport(fetcher: Fetcher): Promise<unknown> {
  return fetchJson(WEATHER_SOURCE_URL, fetcher);
}
