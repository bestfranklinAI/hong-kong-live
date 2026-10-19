import { Bookmark, Check, X } from 'lucide-react';
import { BuildingIndoorButton } from '../navigation/BuildingIndoorButton';
import { useState } from 'react';
import type { SearchResult } from '@hk/contracts';
import { savePin } from './SavedPins';

export function SelectedSearchPlace({
  result,
  onClose,
  onNearby,
  onDirections,
}: {
  result: SearchResult;
  onClose: () => void;
  onNearby: () => void;
  onDirections: () => void;
}) {
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  if (!result.location) return null;
  const coordinates = `${result.location.lat}, ${result.location.lng}`;
  return (
    <article className="search-detail selected-search-place" aria-label="Selected search place">
      <div className="selected-place-heading">
        <h2>{result.sharedPlace?.name ?? result.name}</h2>
        <button className="icon-button" aria-label="Close selected place" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {result.nameZh && <p>{result.nameZh}</p>}
      {result.address && <p>{result.address}</p>}
      <small>Reference location · confirm the entrance</small>
      <button className="walking-submit" onClick={onDirections}>
        Directions
      </button>
      <div className="pin-actions">
        <button
          onClick={() => {
            const success = savePin(result);
            setSaved(success);
            setMessage(success ? 'Pin saved on this device.' : 'Could not save on this device.');
          }}
        >
          {saved ? <Check size={16} /> : <Bookmark size={16} />}
          {saved ? 'Saved' : 'Save pin'}
        </button>
        <button onClick={onNearby}>Search nearby</button>
      </div>
      <BuildingIndoorButton
        key={result.id}
        name={result.sharedPlace?.name ?? result.name}
        nameZh={result.nameZh}
      />
      {result.facility && (
        <details>
          <summary>Venue details</summary>
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
          <a
            className="text-button"
            href={result.facility.website ?? result.facility.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Official venue information ↗
          </a>
        </details>
      )}
      <details>
        <summary>Location & source</summary>
        <p>
          {result.source === 'user'
            ? 'User-supplied pin'
            : `${result.source} · approximate reference location, not an entrance`}
        </p>
        <p>{coordinates}</p>
        <button
          className="text-button"
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
        {result.facility && (
          <>
            <p>
              Source updated: {result.sourceDate?.slice(0, 10) ?? 'Not supplied'} · downloaded{' '}
              {result.facility.fetchedAt.slice(0, 10)}. No live availability.
            </p>
            <a
              className="text-button"
              href={result.facility.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Source dataset ↗
            </a>
          </>
        )}
        {result.sharedPlace && (
          <>
            <p>{result.sharedPlace.address}</p>
            <a
              className="text-button"
              href={result.sharedPlace.url}
              target="_blank"
              rel="noreferrer"
            >
              View shared place in Google Maps ↗
            </a>
          </>
        )}
      </details>
      {message && <p role="status">{message}</p>}
    </article>
  );
}
