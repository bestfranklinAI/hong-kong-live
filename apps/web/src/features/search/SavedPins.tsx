import { useEffect, useState } from 'react';
import { searchResultSchema, type SearchResult, withinHongKong } from '@hk/contracts';
const KEY = 'hk-live-saved-pins-v1';
export function readSavedPins(): SearchResult[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 50).flatMap((item) => {
      const result = searchResultSchema.safeParse(item);
      return result.success &&
        result.data.location &&
        withinHongKong(result.data.location) &&
        result.data.source === 'user'
        ? [result.data]
        : [];
    });
  } catch {
    return [];
  }
}
export function savePin(row: SearchResult) {
  if (!row.location) return false;
  const pin: SearchResult = {
    ...row,
    id: `pin:${row.location.lat},${row.location.lng}`,
    kind: 'coordinate',
    source: 'user',
    sourceDate: null,
    locationPrecision: 'user-supplied',
  };
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([pin, ...readSavedPins().filter((other) => other.id !== pin.id)].slice(0, 50)),
    );
    window.dispatchEvent(new Event('hk-pins-changed'));
    return true;
  } catch {
    return false;
  }
}
export function SavedPins({ onSelect }: { onSelect: (row: SearchResult) => void }) {
  const [pins, setPins] = useState(readSavedPins);
  useEffect(() => {
    const update = () => setPins(readSavedPins());
    window.addEventListener('hk-pins-changed', update);
    return () => window.removeEventListener('hk-pins-changed', update);
  }, []);
  return pins.length ? (
    <section className="unified-search">
      <h2>Your saved pins</h2>
      {pins.map((row) => (
        <div className="saved-pin" key={row.id}>
          <button className="search-result" onClick={() => onSelect(row)}>
            <span>
              <strong>{row.name}</strong>
              <span>
                {row.location!.lat}, {row.location!.lng}
              </span>
            </span>
          </button>
          <button
            className="text-button"
            aria-label={`Remove saved pin ${row.name}`}
            onClick={() => {
              const next = pins.filter((pin) => pin.id !== row.id);
              try {
                localStorage.setItem(KEY, JSON.stringify(next));
                setPins(next);
              } catch {
                /* Keep the visible list when storage is unavailable. */
              }
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  ) : null;
}
