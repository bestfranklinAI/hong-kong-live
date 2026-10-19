import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  discoveryStatusSchema,
  discoveryResponseSchema,
  type Coordinates,
  type DiscoveryIntent,
  type DiscoveryInterest,
  type DiscoveryResponse,
  type SearchResult,
} from '@hk/contracts';
import { MapPin, Sparkles } from 'lucide-react';
import { getJson } from '../live/queries';

const interestLabels: Record<DiscoveryInterest, string> = {
  waterfront: 'Waterfront',
  park: 'Parks',
  culture: 'Arts & culture',
  food: 'Food',
  library: 'Libraries',
  refill: 'Water refill points',
  sports: 'Sports facilities',
};
const mobilityLabels: Record<DiscoveryIntent['mobility'], string> = {
  walking: 'Walking',
  'fewer-stairs': 'Fewer stairs',
  'barrier-free': 'Barrier-free preference',
};
const selectionLabels = {
  map: 'Show on map',
  start: 'Use as starting point',
  end: 'Use as destination',
};

/** Capability gated and explicitly requested; ordinary search never submits text to a model. */
export function DiscoverySearch({
  query,
  language,
  center,
  selectionPurpose = 'map',
  onSelect,
}: {
  query: string;
  language: 'en' | 'tc';
  center?: Coordinates;
  selectionPurpose?: keyof typeof selectionLabels;
  onSelect: (result: SearchResult, intent?: DiscoveryIntent) => void;
}) {
  const capability = useQuery({
    queryKey: ['discovery-evaluation-status'],
    queryFn: async ({ signal }) =>
      discoveryStatusSchema.parse(await getJson('/api/v1/search/discovery/status', signal)),
    staleTime: 300000,
    retry: false,
  });
  const [result, setResult] = useState<DiscoveryResponse>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  if (!capability.data?.enabled) return null;
  async function interpret() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const timeout = AbortSignal.timeout(12000);
    const signal = AbortSignal.any([controller.signal, timeout]);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/search/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ query, language, ...(center ? { center } : {}) }),
      });
      if (!response.ok)
        throw new Error('Experimental search is unavailable. Standard search remains available.');
      const body: unknown = await response.json();
      const parsed = discoveryResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error('Invalid search response');
      signal.throwIfAborted();
      setResult(parsed.data);
    } catch {
      if (!controller.signal.aborted)
        setError(
          timeout.aborted
            ? 'Experimental search timed out. Try again or use standard search.'
            : 'Experimental search is unavailable. Try again or use standard search.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="discovery-evaluation" aria-label="Smart search evaluation">
      <div className="discovery-heading">
        <h3>
          <Sparkles size={17} aria-hidden="true" /> Smart search
        </h3>
        <span className="discovery-badge">Evaluation</span>
      </div>
      {!result && (
        <>
          <p>
            Ask for places in your own words. Only pressing Interpret sends this request to
            TypeSafe’s Jev. Suggestions use source records; routes are calculated separately.
          </p>
          {center && <p>Nearby suggestions use your selected starting point as a reference.</p>}
        </>
      )}
      <button className="discovery-submit" disabled={busy} onClick={() => void interpret()}>
        {busy ? 'Interpreting request…' : result ? 'Interpret again' : 'Interpret this request'}
      </button>
      {busy && (
        <button
          className="text-button"
          onClick={() => {
            pending.current?.abort();
            setBusy(false);
            setError('Interpretation cancelled.');
          }}
        >
          Cancel interpretation
        </button>
      )}
      {busy && <p role="status">Interpreting your preferences…</p>}
      {error && <p role="status">{error}</p>}
      {result && (
        <>
          {(busy || error) && (
            <p className="discovery-retained">
              Previous suggestions for this request remain available.
            </p>
          )}
          <p className="discovery-ranking" role="status">
            {result.mode === 'fixture' ? 'Recorded evaluation response · ' : ''}
            {result.ranking === 'retrieval-fallback'
              ? 'Ranking unavailable · retrieved order'
              : result.ranking === 'not-run'
                ? 'No candidates to rank'
                : 'Ranked source candidates'}
          </p>
          <div className="discovery-intent">
            <h4>Understood as</h4>
            <ul aria-label="Interpreted preferences" className="discovery-preferences">
              {result.intent.interests.map((interest) => (
                <li key={interest}>{interestLabels[interest]}</li>
              ))}
              <li>{mobilityLabels[result.intent.mobility]}</li>
              {result.intent.area && <li>Area: {result.intent.area}</li>}
            </ul>
            {!result.intent.interests.length && (
              <p>No supported place interests were identified.</p>
            )}
            <p>If this missed your meaning, edit your search above.</p>
            {center && <p>Nearby reference: your selected starting point.</p>}
          </div>
          {result.unmatchedInterests.length > 0 && (
            <p className="discovery-coverage">
              No mapped suggestions found for:{' '}
              {result.unmatchedInterests.map((interest) => interestLabels[interest]).join(', ')}.
              This reflects the available catalogue and search area.
            </p>
          )}
          {result.intent.mobility !== 'walking' && (
            <p>
              Accessibility and current lift operation are unverified. Compare the official route
              profiles.
            </p>
          )}
          {result.intent.unverifiedNeeds.length > 0 && (
            <p>
              Not verified:{' '}
              {result.intent.unverifiedNeeds
                .map(
                  (need) =>
                    ({
                      'open-now': 'current opening hours',
                      'working-lifts': 'lift operation',
                      'indoor-position': 'indoor position or floor',
                      'covered-walk': 'continuous weather cover',
                    })[need],
                )
                .join(', ')}
              .
            </p>
          )}
          {result.results.length > 0 && (
            <p>
              Choose a source location below, then check the official route choices before walking.
            </p>
          )}
          {result.results.length === 0 && (
            <p>No source suggestions were selected. Try standard place search.</p>
          )}
          {result.results.map((row) => (
            <button
              className="search-result"
              key={row.id}
              onClick={() => onSelect(row, result.intent)}
            >
              <MapPin size={18} aria-hidden="true" />
              <span>
                <strong>{language === 'tc' ? row.nameZh || row.name : row.name}</strong>
                {row.nameZh && language === 'en' && <span>{row.nameZh}</span>}
                {(row.district || row.address || row.addressZh) && (
                  <span>
                    {(language === 'tc' ? row.addressZh || row.address : row.address) ||
                      row.district}
                  </span>
                )}
                <small>
                  {row.source} ·{' '}
                  {row.locationPrecision === 'address' ? 'address location' : 'reference location'}
                </small>
                <span className="discovery-selection">{selectionLabels[selectionPurpose]} →</span>
              </span>
            </button>
          ))}
          <details>
            <summary>Source limits & interpretation notes</summary>
            {result.notices.map((notice, index) => (
              <p key={index}>{notice}</p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
