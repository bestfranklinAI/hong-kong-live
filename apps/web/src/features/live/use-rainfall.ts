import type { RainfallStyle } from '../../scene/rainfall-raster';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { feedSchema, rainfallSchema, type Feed, type Rainfall } from '@hk/contracts';

export function usableRainfall(feed: Feed<Rainfall> | undefined, now: number): Rainfall | null {
  if (!feed?.data || feed.status === 'unavailable') return null;
  const age = now - Date.parse(feed.data.issuedAt);
  return !Number.isFinite(age) ||
    !Number.isFinite(Date.parse(feed.fetchedAt)) ||
    age < -120_000 ||
    age >= 2 * 60 * 60_000 ||
    now - Date.parse(feed.fetchedAt) >= 2 * 60 * 60_000
    ? null
    : feed.data;
}

export function useRainfall(enabled: boolean) {
  const [now, setNow] = useState(Date.now);
  const [style, setStyle] = useState<RainfallStyle>('smooth');
  const [selected, setSelected] = useState(0);
  const [playMode, setPlayMode] = useState(false);
  const playing = playMode && enabled;
  const query = useQuery({
    queryKey: ['weather', 'rainfall'],
    enabled,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/v1/weather/rainfall/manifest', { signal });
      if (!response.ok) throw new Error('Rainfall connection unavailable.');
      return feedSchema(rainfallSchema).parse(await response.json());
    },
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const publication = usableRainfall(query.data, now);
  const firstValid = publication?.frames.findIndex((f) => Date.parse(f.endsAt) > now) ?? -1;
  const index = Math.max(selected, firstValid, 0);
  const active = enabled && publication !== null && firstValid >= 0;
  useEffect(() => {
    if (!enabled) {
      setPlayMode(false);
      return;
    }
    const update = () => {
      setNow(Date.now());
      if (document.hidden) setPlayMode(false);
    };
    update();
    const timer = window.setInterval(update, 15_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [enabled]);
  useEffect(() => {
    if (!playing || !active) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setSelected((value) =>
        value >= 3 ? Math.max(firstValid, 0) : Math.max(firstValid, value + 1),
      );
    }, 1500);
    return () => clearInterval(timer);
  }, [playing, active, firstValid]);
  return {
    query,
    style,
    setStyle,
    publication: active ? publication : null,
    index,
    now,
    playing: playing && active,
    togglePlay: () => setPlayMode((value) => !value),
    select: (value: number) => {
      setPlayMode(false);
      setSelected(value);
    },
  };
}
export type RainfallControls = ReturnType<typeof useRainfall>;
