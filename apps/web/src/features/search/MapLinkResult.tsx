import { useEffect, useRef, useState } from 'react';
import {
  MAP_LINK_MAX_LENGTH,
  mapLinkResponseSchema,
  type MapLinkResponse,
  type SearchResult,
} from '@hk/contracts';

export function MapLinkResult({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (result: SearchResult) => void;
}) {
  const controller = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<MapLinkResponse>();
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      void resolve();
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
    };
    // A new instance is mounted for each complete input value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function resolve() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError('');
    setResponse(undefined);
    try {
      const result = await fetch('/api/v1/search/links/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: query.trim() }),
        signal: request.signal,
      });
      if (!result.ok) {
        setError(
          result.status === 429
            ? 'Link resolution is busy. Try again in a minute.'
            : 'Paste a supported Google Maps HTTPS link.',
        );
        return;
      }
      const data = mapLinkResponseSchema.parse(await result.json());
      if (!request.signal.aborted) setResponse(data);
    } catch {
      if (!request.signal.aborted)
        setError('Link lookup is unavailable. Paste latitude, longitude instead.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }
  return (
    <section className="unified-search" aria-label="Shared map link">
      <h2>{response?.place ? 'Shared place' : 'Google Maps link'}</h2>
      {response?.place && (
        <div className="shared-place-summary">
          <strong>{response.place.name}</strong>
          <a href={response.place.url} target="_blank" rel="noreferrer">
            Open in Google Maps ↗
          </a>
        </div>
      )}
      {query.length > MAP_LINK_MAX_LENGTH ? (
        <p role="status">This link is too long. Paste the coordinates instead.</p>
      ) : loading || error || !response || (!response.result && !response.candidates.length) ? (
        <div className="pin-actions">
          <button onClick={() => void resolve()} disabled={loading}>
            {loading ? 'Finding place…' : response ? 'Try again' : 'Find place'}
          </button>
        </div>
      ) : null}
      <p role="status">{error || response?.message}</p>
      {response?.candidates.map((row) => (
        <button className="search-result" key={row.id} onClick={() => onSelect(row)}>
          <span>
            <strong>{row.name}</strong>
            <span>{row.address}</span>
            <small>Building location · {row.source}</small>
          </span>
        </button>
      ))}
      {response?.result && (
        <button className="search-result" onClick={() => onSelect(response.result!)}>
          <span>
            <strong>{response.result.name}</strong>
            <span>{response.result.address}</span>
            <small>
              {response.coordinateKind === 'map-centre'
                ? 'Use map centre · check before selecting'
                : 'Select to drop this pin'}
            </small>
          </span>
        </button>
      )}
    </section>
  );
}
