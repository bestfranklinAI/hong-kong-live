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
import { Sparkles } from 'lucide-react';
import { getJson } from '../live/queries';
import { DiscoverySuggestions } from './DiscoverySuggestions';

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
  selectionPurpose?: 'map' | 'start' | 'end';
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
  const [radiusM, setRadiusM] = useState(2000);
  const [resultRadius, setResultRadius] = useState(2000);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  if (!capability.data?.enabled) return null;
  async function interpret(radius = radiusM) {
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
        body: JSON.stringify({ query, language, ...(center ? { center, radiusM: radius } : {}) }),
      });
      if (!response.ok)
        throw new Error('Experimental search is unavailable. Standard search remains available.');
      const body: unknown = await response.json();
      const parsed = discoveryResponseSchema.safeParse(body);
      if (!parsed.success) throw new Error('Invalid search response');
      signal.throwIfAborted();
      setResult(parsed.data);
      setResultRadius(radius);
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
          {center ? (
            <p>Nearby suggestions use your selected starting point as a reference.</p>
          ) : (
            <p>
              Select a mapped From place for nearby suggestions, or name an area in your request.
              Current location is used only after you explicitly resolve it.
            </p>
          )}
        </>
      )}
      {center && (
        <fieldset className="discovery-radius" disabled={busy}>
          <legend>Search around From · straight-line radius</legend>
          {[2000, 5000, 10000].map((radius) => (
            <button
              key={radius}
              type="button"
              aria-pressed={radiusM === radius}
              onClick={() => setRadiusM(radius)}
            >
              {radius / 1000} km
            </button>
          ))}
        </fieldset>
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
                : !result.results.length
                  ? 'Jev selected no candidates'
                  : 'Ranked source candidates'}
            {result.coverage?.referenceProvided &&
              ` · within ${result.coverage.radiusM / 1000} km of From`}
          </p>
          {result && center && radiusM !== resultRadius && (
            <p>
              Radius changed. Press Interpret again to search the new area; the suggestions below
              use the previous radius.
            </p>
          )}
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
            <p>
              If this missed your meaning, edit your search above. Try one activity, such as a park,
              museum, waterfront or library.
            </p>
            {center && <p>Nearby reference: your selected starting point.</p>}
          </div>
          {result.unmatchedInterests.length > 0 && (
            <p className="discovery-coverage">
              No mapped suggestions found for:{' '}
              {result.unmatchedInterests.map((interest) => interestLabels[interest]).join(', ')}.
              This reflects the available catalogue and search area.
            </p>
          )}
          {result.intent.interests.includes('food') && result.coverage && (
            <p className="discovery-coverage">
              Restaurant map coverage: {result.coverage.restaurantsMapped.toLocaleString()} of{' '}
              {result.coverage.restaurantsTotal.toLocaleString()} licence records have coordinates.
              Unlocated restaurants cannot appear nearby. Opening hours and cuisine are not
              verified.
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
            <p>
              {result.coverage?.candidateCount === 0
                ? 'No mapped candidates match this activity, radius and named area. A named area and the From radius must both match.'
                : 'No source suggestions were selected. Jev was not confident enough to recommend a candidate.'}{' '}
              Try standard place search.
            </p>
          )}
          {center && result.results.length === 0 && radiusM < 10000 && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                const wider = radiusM === 2000 ? 5000 : 10000;
                setRadiusM(wider);
                void interpret(wider);
              }}
            >
              Search within {radiusM === 2000 ? 5 : 10} km instead
            </button>
          )}
          <DiscoverySuggestions
            key={`${resultRadius}:${result.results.map((row) => row.id).join(',')}:${result.alternatives?.map((row) => row.id).join(',')}`}
            rows={result.results.length ? result.results : (result.alternatives ?? [])}
            alternatives={!result.results.length && !!result.alternatives?.length}
            intent={result.intent}
            language={language}
            center={center}
            selectionPurpose={selectionPurpose}
            onSelect={onSelect}
          />
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
