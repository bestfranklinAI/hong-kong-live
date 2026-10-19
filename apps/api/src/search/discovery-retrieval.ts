import {
  normalizeSearchText,
  withinHongKong,
  searchResultSchema,
  type DiscoveryIntent,
  type DiscoveryInterest,
  type DiscoveryRequest,
  type SearchResult,
} from '@hk/contracts';
import { curatedPlaces } from './curated';
import { emptyRepository, type SearchRepository } from './repository';

export interface DiscoveryCandidate {
  result: SearchResult;
  interests: DiscoveryInterest[];
  searchText?: string;
}
const distance = (
  a: NonNullable<SearchResult['location']>,
  b: NonNullable<SearchResult['location']>,
) => Math.hypot((a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat) * 111195;

/** Read existing catalogues only. No model-directed URL, geocoding or routing calls. */
export function retrieveDiscoveryCandidates(
  intent: DiscoveryIntent,
  request: DiscoveryRequest,
  repository: SearchRepository = emptyRepository,
  facilities: SearchResult[] = [],
) {
  const rows: DiscoveryCandidate[] = curatedPlaces.map(({ place, result }) => {
    const interests: DiscoveryInterest[] = [];
    if (['waterfront', 'park', 'culture'].includes(place.category))
      interests.push(place.category as 'waterfront' | 'park' | 'culture');
    if (
      !interests.includes('waterfront') &&
      /waterfront|harbourfront|海濱|海邊/i.test([place.description, ...place.tags].join(' '))
    )
      interests.push('waterfront');
    return { result, interests, searchText: [place.description, ...place.tags].join(' ') };
  });
  rows.push(
    ...facilities.flatMap((result): DiscoveryCandidate[] =>
      result.facility ? [{ result, interests: [result.facility.category] }] : [],
    ),
  );
  if (intent.interests.includes('food')) {
    const restaurants = request.center
      ? repository.nearby(request.center.lat, request.center.lng, 100)
      : intent.area
        ? repository.search(intent.area, 100)
        : [];
    rows.push(
      ...restaurants
        .filter((row) => row.source === 'FEHD' && row.kind === 'restaurant')
        .map((result) => ({ result, interests: ['food'] as DiscoveryInterest[] })),
    );
  }
  const area = normalizeSearchText(intent.area);
  const seen = new Set<string>();
  return rows
    .filter(({ result, interests, searchText }) => {
      const parsed = searchResultSchema.safeParse(result);
      if (
        !parsed.success ||
        !result.location ||
        !withinHongKong(result.location) ||
        seen.has(result.id)
      )
        return false;
      if (!interests.some((interest) => intent.interests.includes(interest))) return false;
      if (request.center && distance(request.center, result.location) > 2000) return false;
      const text = normalizeSearchText(
        [
          result.name,
          result.nameZh,
          result.district,
          result.address,
          result.addressZh,
          searchText,
        ].join(' '),
      );
      if (area && !text.includes(area)) return false;
      seen.add(result.id);
      return true;
    })
    .sort((a, b) => {
      if (request.center)
        return (
          distance(request.center, a.result.location!) -
          distance(request.center, b.result.location!)
        );
      return a.result.id.localeCompare(b.result.id);
    })
    .slice(0, 24);
}

/** Ranking receives bounded catalogue labels, without coordinates or inferred access facts. */
export function modelCandidates(candidates: DiscoveryCandidate[]) {
  return candidates.map(({ result, interests }) => ({
    id: result.id,
    name: result.name.slice(0, 120),
    nameZh: result.nameZh.slice(0, 120),
    district: result.district.slice(0, 80),
    source: result.source,
    interests,
  }));
}
