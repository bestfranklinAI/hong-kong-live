import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indoorVenuesSchema, indoorStationsSchema, type IndoorVenue } from '@hk/contracts';
import { getJson } from '../live/queries';
export function IndoorVenueBrowser({ onSelect }: { onSelect: (venue: IndoorVenue) => void }) {
  const [kind, setKind] = useState<'building' | 'station'>('building');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const catalogue = useQuery({
    queryKey: ['indoor-venues', kind],
    queryFn: async ({ signal }) => {
      if (kind === 'building')
        return indoorVenuesSchema.parse(await getJson('/api/v1/routes/indoor/buildings', signal))
          .venues;
      return indoorStationsSchema
        .parse(await getJson('/api/v1/routes/indoor/stations', signal))
        .stations.map((venue) => ({ ...venue, kind: 'station' as const }));
    },
    staleTime: 21600000,
    retry: 1,
  });
  const text = query.trim().toLocaleLowerCase();
  const rows = (catalogue.data ?? []).filter((venue) =>
    `${venue.name} ${venue.nameZh}`.toLocaleLowerCase().includes(text),
  );
  return (
    <section className="indoor-venue-browser" aria-label="Browse indoor maps">
      <div className="indoor-venue-tabs" aria-label="Indoor venue type">
        {(['building', 'station'] as const).map((value) => (
          <button
            key={value}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setLimit(30);
            }}
          >
            {value === 'building' ? 'Buildings' : 'MTR stations'}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="indoor-venue-search">
        Search indoor venues
      </label>
      <input
        id="indoor-venue-search"
        type="search"
        placeholder="Search a building or station"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setLimit(30);
        }}
      />
      {catalogue.isPending && <p role="status">Loading indoor maps…</p>}
      {catalogue.isError && (
        <p role="alert">
          Indoor catalogue unavailable.{' '}
          <button className="text-button" onClick={() => void catalogue.refetch()}>
            Retry
          </button>
        </p>
      )}
      {catalogue.isSuccess && rows.length === 0 && <p>No covered venues match this name.</p>}
      <div className="indoor-venue-results">
        {rows.slice(0, limit).map((venue) => (
          <button key={venue.id} onClick={() => onSelect(venue)}>
            <strong>{venue.name}</strong>
            <span>{venue.nameZh}</span>
          </button>
        ))}
      </div>
      {rows.length > limit && (
        <button className="text-button" onClick={() => setLimit(limit + 30)}>
          Show more venues
        </button>
      )}
    </section>
  );
}
