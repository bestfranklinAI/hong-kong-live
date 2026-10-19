import { useState } from 'react';
import { MapPin, Shuffle } from 'lucide-react';
import { getPlace, type Coordinates, type DiscoveryIntent, type SearchResult } from '@hk/contracts';

const selectionLabels = {
  map: 'Show on map',
  start: 'Use as starting point',
  end: 'Use as destination',
};
const distance = (a: Coordinates, b: Coordinates) =>
  Math.hypot((a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat) * 111195;

/** These refinements use the returned source shortlist; they never trigger another model call. */
export function DiscoverySuggestions({
  rows,
  intent,
  language,
  center,
  selectionPurpose,
  onSelect,
  alternatives = false,
}: {
  rows: SearchResult[];
  intent: DiscoveryIntent;
  language: 'en' | 'tc';
  center?: Coordinates;
  selectionPurpose: keyof typeof selectionLabels;
  onSelect: (row: SearchResult, intent?: DiscoveryIntent) => void;
  alternatives?: boolean;
}) {
  const [closest, setClosest] = useState(false);
  const [picked, setPicked] = useState<string>();
  const ordered = [...rows].sort((a, b) => {
    if (a.id === picked) return -1;
    if (b.id === picked) return 1;
    return closest && center && a.location && b.location
      ? distance(center, a.location) - distance(center, b.location)
      : 0;
  });
  const pickedRow = rows.find((row) => row.id === picked);
  return (
    <div className="discovery-suggestions">
      {alternatives && (
        <p className="discovery-coverage">
          Nearby alternatives · not selected by Jev. Check whether they suit your request.
        </p>
      )}
      {rows.length > 1 && (
        <div className="discovery-refinements" aria-label="Refine source suggestions">
          {center && (
            <button
              aria-pressed={closest}
              onClick={() => {
                setClosest(!closest);
                setPicked(undefined);
              }}
            >
              Closest first
            </button>
          )}
          <button
            onClick={() => {
              const choices = rows.filter((row) => row.id !== picked);
              setPicked(choices[Math.floor(Math.random() * choices.length)].id);
            }}
          >
            <Shuffle size={15} aria-hidden="true" /> Pick for me
          </button>
        </div>
      )}
      {pickedRow && (
        <p role="status">
          Picked {language === 'tc' ? pickedRow.nameZh || pickedRow.name : pickedRow.name}. Select
          it below to use it.
        </p>
      )}
      {ordered.map((row) => {
        const description =
          row.facility?.details || (row.placeId ? getPlace(row.placeId)?.description : '');
        return (
          <button
            className={`search-result discovery-card ${picked === row.id ? 'discovery-picked' : ''}`}
            key={row.id}
            onClick={() => onSelect(row, intent)}
          >
            <MapPin size={18} aria-hidden="true" />
            <span>
              <strong>{language === 'tc' ? row.nameZh || row.name : row.name}</strong>
              {row.nameZh && language === 'en' && <span>{row.nameZh}</span>}
              {(row.district || row.address || row.addressZh) && (
                <span>
                  {(language === 'tc' ? row.addressZh || row.address : row.address) || row.district}
                </span>
              )}
              {description && (
                <span className="discovery-description">{description.slice(0, 220)}</span>
              )}
              {center && row.location && (
                <small>
                  {(distance(center, row.location) / 1000).toFixed(1)} km straight-line from From
                </small>
              )}
              <small>
                {row.source} ·{' '}
                {row.locationPrecision === 'address'
                  ? 'approximate building/address location'
                  : 'reference location'}
              </small>
              {row.locationSource?.sourceDate && (
                <small>
                  Location source updated {row.locationSource.sourceDate} · checked{' '}
                  {row.locationSource.fetchedAt.slice(0, 10)}
                </small>
              )}
              <span className="discovery-selection">{selectionLabels[selectionPurpose]} →</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
