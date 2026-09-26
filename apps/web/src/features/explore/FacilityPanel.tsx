import { useState } from 'react';
import {
  facilityLabels,
  type FacilityCategory,
  type FacilitiesResponse,
  type SearchResult,
} from '@hk/contracts';

export function FacilityFilters({
  selected,
  onChange,
}: {
  selected?: FacilityCategory;
  onChange: (value?: FacilityCategory) => void;
}) {
  return (
    <div className="category-scroll facility-filters" aria-label="Public facility layers">
      {(['sports', 'library', 'refill'] as const).map((category) => (
        <button
          key={category}
          className={`filter-chip ${selected === category ? 'active' : ''}`}
          aria-pressed={selected === category}
          onClick={() => onChange(selected === category ? undefined : category)}
        >
          {facilityLabels[category]}
        </button>
      ))}
    </div>
  );
}
export function FacilityPanel({
  category,
  data,
  loading,
  failed,
  onSelect,
  retry,
}: {
  category: FacilityCategory;
  data?: FacilitiesResponse;
  loading: boolean;
  failed: boolean;
  onSelect: (row: SearchResult) => void;
  retry: () => void;
}) {
  const [limit, setLimit] = useState(30);
  const rows = (data?.records ?? []).filter((row) => row.facility?.category === category);
  const sources = data?.sources.filter((source) => source.category === category) ?? [];
  return (
    <section className="unified-search" aria-label={facilityLabels[category]}>
      <h2>{facilityLabels[category]}</h2>
      <p className="search-notice">
        {rows.length} location records · select a marker or a place below. Zoom in to separate
        grouped markers.
      </p>
      <p className="search-notice">
        {category === 'library'
          ? 'Includes mobile-library stops; check their service schedule.'
          : category === 'sports'
            ? 'Sports centres only. Court bookings and live availability are not included.'
            : 'Public refill points at LCSD venues and AFCD country parks. Working status is not reported.'}
      </p>
      {loading && <p role="status">Loading official facilities…</p>}
      {(failed || (!loading && !sources.length)) && (
        <p role="status">
          Facility data is unavailable.{' '}
          <button className="text-button" onClick={retry}>
            Retry
          </button>
        </p>
      )}
      {sources.map((source) => (
        <p className="search-provenance" key={source.dataset}>
          {source.title}: {source.count} ·{' '}
          {source.status === 'unavailable'
            ? 'Preparing or unavailable'
            : `${source.status === 'stale' ? 'Last available snapshot · ' : ''}checked ${source.fetchedAt?.slice(0, 10)}`}
        </p>
      ))}
      {rows.slice(0, limit).map((row) => (
        <button className="search-result" key={row.id} onClick={() => onSelect(row)}>
          <span>
            <strong>{row.name}</strong>
            <span>{row.nameZh}</span>
            <span>{row.address || row.facility?.locationNote}</span>
          </span>
        </button>
      ))}
      {rows.length > limit && (
        <button className="text-button" onClick={() => setLimit(limit + 30)}>
          Show 30 more
        </button>
      )}
    </section>
  );
}
