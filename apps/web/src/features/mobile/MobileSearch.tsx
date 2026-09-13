import { Search, X } from 'lucide-react';
import { mtrLines, mtrStations, type Category, type StationSelection } from '@hk/contracts';
import { haptic } from './sheet-motion';

export function MobileSearch({
  query,
  category,
  onQuery,
  onCategory,
  onWeather,
  onFocus,
}: {
  query: string;
  category: string;
  onQuery: (query: string) => void;
  onCategory: (category: Category | 'all') => void;
  onWeather: () => void;
  onFocus: () => void;
}) {
  return (
    <>
      <div className="mobile-search" data-no-drag>
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Search places, transport, sensors"
          placeholder="Search places, transport, sensors…"
          value={query}
          onFocus={onFocus}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button aria-label="Clear search" onClick={() => onQuery('')}>
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mobile-categories" aria-label="Quick categories" data-no-drag>
        {(
          [
            ['all', 'All'],
            ['culture', 'Arts'],
            ['waterfront', 'Waterfront'],
            ['park', 'Parks'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={category === id}
            onClick={() => {
              haptic();
              onCategory(id);
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            haptic();
            onWeather();
          }}
        >
          Weather
        </button>
      </div>
    </>
  );
}

export function MobileSearchResults({
  query,
  onStation,
  onWeather,
}: {
  query: string;
  onStation: (selection: StationSelection) => void;
  onWeather: () => void;
}) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const stations = Object.entries(mtrStations)
    .filter(([code, station]) =>
      [code, station.name, station.nameZh].some((value) => value.toLowerCase().includes(q)),
    )
    .slice(0, 6);
  const weatherMatch = /weather|rain|temperature|sensor|天氣|雨|溫/.test(q);
  return (
    <div className="mobile-search-results">
      {stations.length > 0 && <h2>Transport</h2>}
      {stations.map(([station, item]) => (
        <button
          key={station}
          onClick={() => {
            const line = mtrLines.find((line) => line.stations.includes(station))!;
            onStation({ line: line.code, station });
          }}
        >
          <strong>{item.name}</strong>
          <span>{item.nameZh} · MTR station</span>
        </button>
      ))}
      {weatherMatch && (
        <button onClick={onWeather}>
          <strong>Local weather & sensors</strong>
          <span>Regional temperatures, rainfall and live observations</span>
        </button>
      )}
    </div>
  );
}
