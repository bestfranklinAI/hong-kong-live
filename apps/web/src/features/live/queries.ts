import { mtrLines } from '@hk/contracts';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  arrivalsFeedSchema,
  weatherFeedSchema,
  feedSchema,
  regionalWeatherSchema,
} from '@hk/contracts';
import { displayFeed } from './display-feed';

export function useDisplayTime() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = window.setInterval(update, 15_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return now;
}

export async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  // An unavailable provider can still return a valid, useful freshness envelope.
  const body: unknown = await response.json();
  if (!response.ok && !(body && typeof body === 'object' && 'status' in body))
    throw new Error('This source could not be reached. Please try again.');
  return body;
}

export function useWeather() {
  const now = useDisplayTime();
  const query = useQuery({
    queryKey: ['weather', 'current'],
    queryFn: async ({ signal }) =>
      weatherFeedSchema.parse(await getJson('/api/v1/weather/current', signal)),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const feed = displayFeed(query.data, query.isError, now, 15 * 60_000, 60_000);
  const iconAge = now - Date.parse(feed?.data?.iconUpdatedAt ?? '');
  const data =
    feed?.data && !(iconAge >= -120_000 && iconAge < 2 * 60 * 60_000)
      ? { ...feed.data, icon: null, condition: 'Condition unavailable' }
      : feed?.data;
  return { ...query, data: feed ? { ...feed, data: data ?? null } : undefined };
}

export function useArrivals(line: string, station: string, enabled = true) {
  const now = useDisplayTime();
  const query = useQuery({
    queryKey: ['arrivals', line, station],
    enabled,
    queryFn: async ({ signal }) =>
      arrivalsFeedSchema.parse(
        await getJson(`/api/v1/arrivals?${new URLSearchParams({ line, station })}`, signal),
      ),
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
  return { ...query, data: displayFeed(query.data, query.isError, now, 90_000, 30_000) };
}

export function useRegionalWeather() {
  const now = useDisplayTime();
  const query = useQuery({
    queryKey: ['weather', 'regional'],
    queryFn: async ({ signal }) =>
      feedSchema(regionalWeatherSchema).parse(await getJson('/api/v1/weather/regional', signal)),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const feed = displayFeed(query.data, query.isError, now, 15 * 60_000, 60_000);
  const data =
    feed?.data?.map((item) => {
      const usable = (time: string | null) =>
        time !== null && now - Date.parse(time) >= -120_000 && now - Date.parse(time) < 90 * 60_000;
      return {
        ...item,
        temperature: usable(item.temperatureAt) ? item.temperature : null,
        humidity: usable(item.humidityAt) ? item.humidity : null,
      };
    }) ?? null;
  return { ...query, data: feed ? { ...feed, data } : undefined };
}

// Share station query keys with the detail panel; inactive views stop line-wide polling.
export function useLineArrivals(line: string, enabled: boolean) {
  const now = useDisplayTime();
  const stations = mtrLines.find((item) => item.code === line)?.stations ?? [];
  const queries = useQueries({
    queries: stations.map((station) => ({
      queryKey: ['arrivals', line, station],
      enabled,
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        arrivalsFeedSchema.parse(
          await getJson('/api/v1/arrivals?' + new URLSearchParams({ line, station }), signal),
        ),
      staleTime: 30_000,
      refetchInterval: enabled ? 30_000 : (false as const),
      refetchIntervalInBackground: false,
    })),
  });
  return queries.map((query, i) => ({
    station: stations[i],
    feed: displayFeed(query.data, query.isError, now, 90_000, 30_000),
  }));
}
