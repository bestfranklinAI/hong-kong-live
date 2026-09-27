import { RegionalWeatherPanel } from './RegionalWeatherPanel';
import { RainfallPanel } from './RainfallPanel';
import type { RainfallControls } from './use-rainfall';
import { Droplets, ExternalLink, RefreshCw, Thermometer } from 'lucide-react';
import { useWeather } from './queries';
import { hkSourceTime } from '../../shared/format';
import { WeatherGlyph } from './WeatherGlyph';

export function WeatherPanel({ rain }: { rain: RainfallControls }) {
  const query = useWeather();
  const feed = query.data;
  const weather = feed?.data;
  return (
    <>
      <div className="panel-heading explore-heading">
        <h1>Weather</h1>
      </div>
      <RegionalWeatherPanel />
      <RainfallPanel rain={rain} />
      <div className="weather-hero">
        <WeatherGlyph icon={weather?.icon} />
        <strong>{weather?.temperature != null ? `${weather.temperature}°` : '—'}</strong>
        <span>
          {query.isPending ? 'Checking the weather…' : weather?.condition || 'Weather unavailable'}
        </span>
        <small>{weather?.station || 'Hong Kong Observatory'} · reference reading</small>
      </div>
      <div className="stat-grid">
        <div>
          <Droplets size={19} />
          <span>Humidity</span>
          <strong>{weather?.humidity != null ? `${weather.humidity}%` : '—'}</strong>
        </div>
        <div>
          <Thermometer size={19} />
          <span>Temperature</span>
          <strong>{weather?.temperature != null ? `${weather.temperature} °C` : '—'}</strong>
        </div>
      </div>
      <div className="source-card">
        <span className={`status-label ${feed?.status === 'fresh' ? 'fresh' : ''}`}>
          <span />
          {feed?.mode === 'fixture'
            ? 'Recorded test snapshot'
            : query.isError
              ? 'Connection unavailable'
              : feed?.status === 'fresh'
                ? 'Latest source report'
                : 'Source update delayed'}
        </span>
        <p>
          Source time: {hkSourceTime(feed?.sourceUpdatedAt)}. These are station observations, not a
          forecast for every point on the map.
        </p>
        <button
          className="text-button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={14} className={query.isFetching ? 'spinning' : ''} />
          Refresh observations
        </button>
      </div>
      <div className="feature-note">
        <h3>Official warnings</h3>
        <p>
          Check official HKO warnings before making weather-sensitive plans. The rainfall colours
          represent forecast amounts, not warning levels.
        </p>
        <a href="https://www.hko.gov.hk/en/index.html" target="_blank" rel="noreferrer">
          Open Hong Kong Observatory <ExternalLink size={14} />
        </a>
      </div>
    </>
  );
}
