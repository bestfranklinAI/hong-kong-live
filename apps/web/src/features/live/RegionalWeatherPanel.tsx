import { useState } from 'react';
import { Droplets, Thermometer, RefreshCw } from 'lucide-react';
import { useRegionalWeather } from './queries';
import { hkSourceTime } from '../../shared/format';

export function RegionalWeatherPanel() {
  const query = useRegionalWeather();
  const [station, setStation] = useState('Hong Kong Observatory');
  const observations = query.data?.data;
  const selected = observations?.find((item) => item.station === station);
  return (
    <section className="regional-weather" aria-label="Regional weather observations">
      <span className="eyebrow">MEASURED AROUND HONG KONG</span>
      <h2>Weather near you.</h2>
      <p>
        Choose an observation station. Readings describe that site, not every street in its
        district.
      </p>
      <label className="field-label" htmlFor="weather-station">
        Observation station
      </label>
      <select
        id="weather-station"
        className="station-select"
        value={station}
        disabled={!observations?.length}
        onChange={(event) => setStation(event.target.value)}
      >
        {!observations?.some((item) => item.station === station) && (
          <option value={station}>{station}</option>
        )}
        {observations?.map((item) => (
          <option key={item.station} value={item.station}>
            {item.station}
          </option>
        ))}
      </select>
      <div className="stat-grid">
        <div>
          <Thermometer size={19} />
          <span>Temperature</span>
          <strong>{selected?.temperature != null ? `${selected.temperature} °C` : '—'}</strong>
          <small>
            {selected?.station ?? station}
            <br />
            {hkSourceTime(selected?.temperatureAt)}
          </small>
        </div>
        <div>
          <Droplets size={19} />
          <span>Humidity</span>
          <strong>{selected?.humidity != null ? `${selected.humidity}%` : '—'}</strong>
          <small>
            {selected?.humidity != null
              ? `${selected.station} · ${hkSourceTime(selected.humidityAt)}`
              : 'No current reading supplied for this station.'}
          </small>
        </div>
      </div>
      <div className="source-card">
        <span
          className={`status-label ${query.data?.status === 'fresh' && selected?.temperature != null ? 'fresh' : ''}`}
        >
          <span />
          {query.data?.mode === 'fixture'
            ? 'Recorded test snapshot'
            : query.isPending
              ? 'Loading observation stations…'
              : !selected || selected.temperature === null
                ? 'Station reading unavailable'
                : query.data?.status === 'fresh'
                  ? 'Latest regional observations'
                  : 'Source update delayed'}
        </span>
        <p>
          Fetched: {hkSourceTime(query.data?.fetchedAt)}. Temperature and humidity retain their own
          observation times.
        </p>
        <button
          className="text-button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={14} />
          Refresh regional readings
        </button>
      </div>
    </section>
  );
}
