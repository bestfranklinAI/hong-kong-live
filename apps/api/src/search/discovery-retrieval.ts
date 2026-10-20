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
import { discoveryAreaAliases } from './jev-areas';

export interface DiscoveryCandidate {
  result: SearchResult;
  interests: DiscoveryInterest[];
  searchText?: string;
  distanceM?: number;
}
export const discoveryDistance = (
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
      result.facility
        ? [{ result, interests: [result.facility.category], searchText: result.facility.details }]
        : [],
    ),
  );
  if (intent.interests.includes('food')) {
    const restaurants = request.center
      ? request.radiusM && request.radiusM !== 2000
        ? repository.nearby(request.center.lat, request.center.lng, 100, request.radiusM)
        : repository.nearby(request.center.lat, request.center.lng, 100)
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
  const aliases = discoveryAreaAliases(intent.area);
  const seen = new Set<string>();
  const filtered = rows
    .filter(({ result, interests, searchText }) => {
      const parsed = searchResultSchema.safeParse(result);
      if (
        !parsed.success ||
        !result.location ||
        !withinHongKong(result.location) ||
        seen.has(result.id)
      )
        return false;
      if (
        result.source === 'curated' &&
        facilities.some(
          (official) =>
            official.location &&
            interests
              .filter((interest) => intent.interests.includes(interest))
              .every((interest) => interest === official.facility?.category) &&
            discoveryDistance(result.location!, official.location) < 100 &&
            ((official.name &&
              normalizeSearchText(official.name) === normalizeSearchText(result.name)) ||
              (official.nameZh &&
                normalizeSearchText(official.nameZh) === normalizeSearchText(result.nameZh))),
        )
      )
        return false;
      if (!interests.some((interest) => intent.interests.includes(interest))) return false;
      if (
        request.center &&
        discoveryDistance(request.center, result.location) > (request.radiusM ?? 2000)
      )
        return false;
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
      const areaText = text.replace(/\band\b/g, ' ').replace(/\s+/g, ' ');
      if (
        area &&
        !aliases.some((alias) =>
          areaText.includes(alias.replace(/\band\b/g, ' ').replace(/\s+/g, ' ')),
        )
      )
        return false;
      seen.add(result.id);
      return true;
    })
    .sort((a, b) => {
      if (request.center)
        return (
          discoveryDistance(request.center, a.result.location!) -
          discoveryDistance(request.center, b.result.location!)
        );
      return a.result.id.localeCompare(b.result.id);
    });
  // Reserve space for each requested interest so dense refill/restaurant layers cannot crowd out parks.
  const selected: DiscoveryCandidate[] = [];
  const groups = intent.interests.map((interest) =>
    filtered.filter((row) => row.interests.includes(interest)),
  );
  const depth = Math.max(0, ...groups.map((group) => group.length));
  for (let offset = 0; offset < depth && selected.length < 24; offset++) {
    for (const group of groups) {
      const candidate = group[offset];
      if (candidate && !selected.includes(candidate) && selected.length < 24) {
        selected.push(candidate);
      }
    }
  }
  return selected.map((candidate) => ({
    ...candidate,
    ...(request.center
      ? {
          distanceM: Math.round(discoveryDistance(request.center, candidate.result.location!)),
        }
      : {}),
  }));
}

/** Ranking receives bounded catalogue labels, without coordinates or inferred access facts. */
export function modelCandidates(candidates: DiscoveryCandidate[]) {
  return candidates.map(({ result, interests, searchText, distanceM }) => ({
    id: result.id,
    name: result.name.slice(0, 120),
    nameZh: result.nameZh.slice(0, 120),
    district: result.district.slice(0, 80),
    source: result.source,
    interests,
    description: (searchText ?? '').slice(0, 500),
    ...(distanceM !== undefined ? { distanceM } : {}),
  }));
}
