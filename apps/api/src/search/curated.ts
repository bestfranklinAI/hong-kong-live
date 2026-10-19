import { places, type SearchResult } from '@hk/contracts';

export const curatedPlaces = places
  .filter((place) => !place.station)
  .map((place) => ({
    place,
    result: {
      id: `curated:${place.id}`,
      placeId: place.id,
      kind: 'place',
      name: place.name,
      nameZh: place.nameZh,
      address: '',
      addressZh: '',
      district: place.district,
      location: { lat: place.lat, lng: place.lng },
      locationPrecision: 'reference',
      source: 'curated',
      sourceDate: null,
    } satisfies SearchResult,
  }));
