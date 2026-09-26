import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  coordinateResult,
  isMapLinkInput,
  parseCoordinates,
  searchResponseSchema,
  locateResponseSchema,
  type SearchResult,
} from '@hk/contracts';
import { MapPin, Search } from 'lucide-react';
import { getJson } from '../live/queries';
import './search.css';
import { MapLinkResult } from './MapLinkResult';

export function SearchResults({
  query,
  language,
  onSelect,
}: {
  query: string;
  language: 'en' | 'tc';
  onSelect: (result: SearchResult) => void;
}) {
  const [debounced, setDebounced] = useState(query);
  const [detail, setDetail] = useState<{
    query: string;
    result: SearchResult;
    message: string;
    candidates: SearchResult[];
  }>();
  const [locating, setLocating] = useState(false);
  const [controller, setController] = useState<AbortController>();
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);
  useEffect(() => () => controller?.abort(), [controller, query]);
  const coordinates = parseCoordinates(query);
  const search = useQuery({
    queryKey: ['search', debounced, language],
    enabled:
      Boolean(debounced.trim()) &&
      !isMapLinkInput(debounced) &&
      parseCoordinates(debounced).kind === 'text',
    queryFn: async ({ signal }) =>
      searchResponseSchema.parse(
        await getJson(
          `/api/v1/search?${new URLSearchParams({ q: debounced, language, limit: '12' })}`,
          signal,
        ),
      ),
    staleTime: 60000,
    retry: 1,
  });
  if (!query.trim()) return null;
  if (isMapLinkInput(query)) return <MapLinkResult key={query} query={query} onSelect={onSelect} />;
  const current = detail?.query === query ? detail : undefined;
  const results =
    coordinates.kind === 'coordinates'
      ? coordinates.supported
        ? [coordinateResult(coordinates.location)]
        : []
      : coordinates.kind === 'text' && debounced === query
        ? (search.data?.results ?? [])
        : [];
  const notices =
    coordinates.kind === 'invalid'
      ? [coordinates.message]
      : coordinates.kind === 'coordinates'
        ? [
            !coordinates.supported
              ? 'Outside the Hong Kong study area.'
              : coordinates.swapped
                ? 'Longitude was entered first. Select the pin below to confirm the suggested order.'
                : 'Latitude, longitude · select to drop a pin.',
          ]
        : debounced === query
          ? (search.data?.notices ?? [])
          : [];
  async function select(row: SearchResult) {
    if (row.location || row.station || row.placeId) {
      onSelect(row);
      return;
    }
    if (row.source !== 'FEHD') return;
    controller?.abort();
    const next = new AbortController();
    setController(next);
    setLocating(true);
    setDetail({ query, result: row, message: 'Looking for an address match…', candidates: [] });
    try {
      const response = await fetch(
        `/api/v1/search/restaurants/${encodeURIComponent(row.id)}/locate`,
        { method: 'POST', signal: next.signal },
      );
      if (!response.ok) throw new Error('Lookup unavailable');
      const data = locateResponseSchema.parse(await response.json());
      if (next.signal.aborted) return;
      setDetail({ query, ...data });
      if (data.result.location) onSelect(data.result);
    } catch {
      if (!next.signal.aborted)
        setDetail({
          query,
          result: row,
          candidates: [],
          message: 'Address lookup unavailable. You can paste coordinates into search instead.',
        });
    } finally {
      if (!next.signal.aborted) setLocating(false);
    }
  }
  return (
    <section className="unified-search" aria-label="Search results">
      <div className="results-heading">
        <h2>Search results</h2>
        {coordinates.kind === 'text' && (search.isFetching || query !== debounced) && (
          <span role="status">Searching…</span>
        )}
      </div>
      {notices.map((notice) => (
        <p className="search-notice" key={notice}>
          {notice}
        </p>
      ))}
      {coordinates.kind === 'text' && search.isError && (
        <p role="status">
          Search is unavailable. Coordinate pins still work.{' '}
          <button className="text-button" onClick={() => void search.refetch()}>
            Retry
          </button>
        </p>
      )}
      {current && (
        <article className="search-detail">
          <strong>{current.result.name}</strong>
          <p>{current.result.address}</p>
          <p>{current.result.addressZh}</p>
          <p role="status">{current.message}</p>
          {current.result.expiryDate && (
            <small>
              Licence expiry: {current.result.expiryDate}. A licence does not confirm opening hours.
            </small>
          )}
          {!locating &&
            current.candidates.map((row) => (
              <button className="search-result" key={row.id} onClick={() => onSelect(row)}>
                <span>
                  <strong>{row.name}</strong>
                  <span>{row.address || row.nameZh}</span>
                  <small>Possible address · not a confirmed restaurant location</small>
                </span>
              </button>
            ))}
        </article>
      )}
      {results.map((row) => (
        <button className="search-result" key={row.id} onClick={() => void select(row)}>
          <MapPin size={20} aria-hidden="true" />
          <span>
            <strong>{language === 'tc' ? row.nameZh || row.name : row.name}</strong>
            {row.nameZh && language === 'en' && <span>{row.nameZh}</span>}
            <span>{language === 'tc' ? row.addressZh || row.address : row.address}</span>
            <small>
              {row.source === 'user' ? 'Go to coordinates' : `${row.source} · ${row.kind}`}
              {!row.location && row.kind === 'restaurant' ? ' · location not yet verified' : ''}
            </small>
          </span>
        </button>
      ))}
      {coordinates.kind === 'text' &&
        !search.isFetching &&
        debounced === query &&
        search.data &&
        !results.length && (
          <p className="search-notice">
            <Search size={18} /> No matching places. Try a building, street address, Chinese name or
            coordinates.
          </p>
        )}
      {coordinates.kind === 'text' && search.data?.catalogue.sourceDate && (
        <p className="search-provenance">
          Restaurant catalogue: {search.data.catalogue.count.toLocaleString()} licences ·{' '}
          <a
            href="https://www.fehd.gov.hk/english/licensing/license/text/LP_Restaurants_EN.XML"
            target="_blank"
            rel="noreferrer"
          >
            FEHD
          </a>{' '}
          source {search.data.catalogue.sourceDate}. Address lookup by{' '}
          <a href="https://www.map.gov.hk/" target="_blank" rel="noreferrer">
            Lands Department
          </a>
          . Positions may be approximate.
        </p>
      )}
    </section>
  );
}
