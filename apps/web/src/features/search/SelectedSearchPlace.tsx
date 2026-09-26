import { useState } from 'react';
import type { SearchResult } from '@hk/contracts';
import { savePin } from './SavedPins';
export function SelectedSearchPlace({
  result,
  onClose,
  onNearby,
}: {
  result: SearchResult;
  onClose: () => void;
  onNearby: () => void;
}) {
  const [message, setMessage] = useState('');
  if (!result.location) return null;
  const coordinates = `${result.location.lat}, ${result.location.lng}`;
  return (
    <article className="search-detail selected-search-place" aria-label="Selected search place">
      <button className="text-button" onClick={onClose}>
        Close pin ×
      </button>
      <h2>{result.name}</h2>
      {result.nameZh && <p>{result.nameZh}</p>}
      <p>{result.address}</p>
      <small>
        {result.source === 'user'
          ? 'User-supplied pin'
          : `${result.source} · approximate reference location, not an entrance`}
      </small>
      <p>{coordinates}</p>
      {result.facility && (
        <>
          <p>{result.facility.details}</p>
          {result.facility.detailsZh && <p>{result.facility.detailsZh}</p>}
          {result.facility.locationNote && (
            <p>
              At the venue: {result.facility.locationNote} {result.facility.locationNoteZh}
            </p>
          )}
          <p>
            Published hours:{' '}
            {result.facility.hours || 'Not supplied — check the official venue page.'}
          </p>
          {result.facility.phone && <p>Telephone: {result.facility.phone}</p>}
          <p className="search-provenance">
            Source updated: {result.sourceDate?.slice(0, 10) ?? 'Not supplied'} · downloaded{' '}
            {result.facility.fetchedAt.slice(0, 10)}. Reference coordinates, not a confirmed
            entrance or floor. No live availability.
          </p>
          <p>
            <a
              href={result.facility.website ?? result.facility.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Official venue information ↗
            </a>
            {' · '}
            <a href={result.facility.sourceUrl} target="_blank" rel="noreferrer">
              Source dataset ↗
            </a>
          </p>
        </>
      )}
      <div className="pin-actions">
        <button
          onClick={() =>
            setMessage(
              savePin(result) ? 'Pin saved on this device.' : 'Could not save on this device.',
            )
          }
        >
          Save pin
        </button>
        <button
          onClick={() => {
            if (!navigator.clipboard) {
              setMessage('Copy unavailable. Select the coordinates above.');
              return;
            }
            void navigator.clipboard
              .writeText(coordinates)
              .then(() => setMessage('Coordinates copied.'))
              .catch(() => setMessage('Copy unavailable. Select the coordinates above.'));
          }}
        >
          Copy coordinates
        </button>
        <button onClick={onNearby}>Search nearby</button>
      </div>
      <p role="status">{message}</p>
    </article>
  );
}
