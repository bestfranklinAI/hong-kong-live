import { SearchResults } from '../search/SearchResults';
import { SavedPins } from '../search/SavedPins';
import type { SearchResult } from '@hk/contracts';
import { useMemo } from 'react';
import { ArrowUpRight, Bookmark, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Category, Place } from '@hk/contracts';
import { categoryLabels, searchPlaces } from './places';
import { IconButton, PlaceIcon } from '../../shared/ui';
import { usePreferences } from '../../app/preferences';
import { FacilityFilters, FacilityPanel } from './FacilityPanel';
import type { FacilityCategory } from '@hk/contracts';
import type { useFacilities } from './facilities';

interface Props {
  facility?: FacilityCategory;
  facilities: ReturnType<typeof useFacilities>;
  onFacility: (value?: FacilityCategory) => void;
  onSearchSelect: (row: SearchResult) => void;
  selectedId?: string;
  onSelect: (place: Place) => void;
  savedOnly: boolean;
  onToggleSavedOnly: () => void;
  query: string;
  category: Category | 'all';
  onQuery: (query: string) => void;
  onCategory: (category: Category | 'all') => void;
}

export function ExplorePanel({
  facility,
  facilities,
  onFacility,
  onSearchSelect,
  selectedId,
  onSelect,
  savedOnly,
  onToggleSavedOnly,
  query,
  category,
  onQuery: setQuery,
  onCategory: setCategory,
}: Props) {
  const language = usePreferences((state) => state.mapLanguage);
  const savedIds = usePreferences((state) => state.savedIds);
  const toggleSaved = usePreferences((state) => state.toggleSaved);
  const results = useMemo(
    () =>
      searchPlaces(query, category).filter((place) => !savedOnly || savedIds.includes(place.id)),
    [query, category, savedOnly, savedIds],
  );

  return (
    <>
      <div className="panel-heading">
        <span className="eyebrow">A NEW PERSPECTIVE</span>
        <h1>
          Your city,
          <br />
          <span>a little closer.</span>
        </h1>
        <p>Discover places, public facilities and useful stops across Hong Kong.</p>
      </div>
      <div className="search-field">
        <Search size={19} aria-hidden="true" />
        <label className="sr-only" htmlFor="place-search">
          Search places in English or Chinese
        </label>
        <input
          id="place-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Place, coordinates or Google Maps link…"
          autoComplete="off"
        />
        {query && (
          <IconButton label="Clear search" onClick={() => setQuery('')}>
            <X size={16} />
          </IconButton>
        )}
        <span className="search-language" aria-hidden="true">
          中 / EN
        </span>
      </div>
      <FacilityFilters selected={facility} onChange={onFacility} />
      {facility && !query.trim() && (
        <FacilityPanel
          key={facility}
          category={facility}
          data={facilities.data}
          loading={facilities.isPending}
          failed={facilities.isError}
          retry={() => void facilities.refetch()}
          onSelect={onSearchSelect}
        />
      )}
      {query.trim() && !savedOnly && (
        <SearchResults query={query} language={language} onSelect={onSearchSelect} />
      )}
      {!facility && (!query.trim() || savedOnly) && (
        <>
          <SavedPins onSelect={onSearchSelect} />
          <div className="category-scroll" aria-label="Filter places by category">
            <button
              className={`filter-chip ${category === 'all' ? 'active' : ''}`}
              aria-pressed={category === 'all'}
              onClick={() => setCategory('all')}
            >
              All places
            </button>
            {(['culture', 'waterfront', 'park', 'landmark', 'station'] as Category[]).map(
              (value) => (
                <button
                  key={value}
                  className={`filter-chip ${category === value ? 'active' : ''}`}
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                >
                  {categoryLabels[value]}
                </button>
              ),
            )}
          </div>
          {!query && category === 'all' && !savedOnly && (
            <button
              className="discovery-banner"
              onClick={() => onSelect(searchPlaces('Victoria Peak', 'landmark')[0])}
            >
              <span className="banner-contours" aria-hidden="true" />
              <span className="eyebrow">THE CITY FROM ABOVE</span>
              <strong>Take the scenic view.</strong>
              <span className="banner-footer">
                Discover Victoria Peak <ArrowUpRight size={18} />
              </span>
            </button>
          )}
          <div className="results-heading">
            <h2>{savedOnly ? 'Your saved places' : 'Places to get lost in'}</h2>
            <span aria-live="polite">
              {results.length} {results.length === 1 ? 'place' : 'places'}
            </span>
            <button
              className={`saved-filter ${savedOnly ? 'active' : ''}`}
              aria-pressed={savedOnly}
              onClick={onToggleSavedOnly}
              title="Show saved places"
            >
              <SlidersHorizontal size={16} />
              <span className="sr-only">Show saved places</span>
            </button>
          </div>
          <div className="place-list">
            {results.map((place) => (
              <article
                key={place.id}
                className={`place-row ${selectedId === place.id ? 'selected' : ''}`}
              >
                <button
                  className="place-select"
                  onClick={() => onSelect(place)}
                  aria-pressed={selectedId === place.id}
                >
                  <span className={`place-symbol ${place.category}`}>
                    <PlaceIcon category={place.category} />
                  </span>
                  <span className="place-text">
                    <strong>{place.name}</strong>
                    <span>
                      {place.nameZh} <span className="text-dot">·</span>{' '}
                      {categoryLabels[place.category]}
                    </span>
                  </span>
                </button>
                <IconButton
                  label={`${savedIds.includes(place.id) ? 'Unsave' : 'Save'} ${place.name}`}
                  className={savedIds.includes(place.id) ? 'is-saved' : ''}
                  aria-pressed={savedIds.includes(place.id)}
                  onClick={() => toggleSaved(place.id)}
                >
                  <Bookmark
                    size={17}
                    fill={savedIds.includes(place.id) ? 'currentColor' : 'none'}
                  />
                </IconButton>
              </article>
            ))}
            {results.length === 0 && (
              <div className="empty-state">
                <Search size={24} />
                <h3>{savedOnly ? 'A little inspiration, saved.' : 'No places found'}</h3>
                <p>
                  {savedOnly
                    ? 'Tap a bookmark on any place to keep it here.'
                    : 'Try “西九”, “Peak”, or choose another category.'}
                </p>
              </div>
            )}
          </div>
          <p className="catalog-note">
            A selected collection, not every attraction. Search a district in English or Chinese.
          </p>
        </>
      )}
    </>
  );
}
