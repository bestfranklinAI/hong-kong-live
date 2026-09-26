import {
  categorySchema,
  facilityCategorySchema,
  type FacilityCategory,
  isMapLinkInput,
  MAP_LINK_MAX_LENGTH,
  coordinatesSchema,
  withinHongKong,
  stationSelectionSchema,
  type Category,
  type ViewMode,
} from '@hk/contracts';
import { getPlace } from '../features/explore/places';

export interface AtlasSearch {
  facility?: FacilityCategory;
  mode: ViewMode;
  pinLat?: number;
  pinLng?: number;
  place?: string;
  line?: string;
  station?: string;
  q?: string;
  category?: Category;
}

export function parseSearch(input: Record<string, unknown>): AtlasSearch {
  const mode = input.mode === 'weather' || input.mode === 'transport' ? input.mode : 'explore';
  const place = typeof input.place === 'string' && getPlace(input.place) ? input.place : undefined;
  const station = stationSelectionSchema.safeParse({ line: input.line, station: input.station });
  const category = categorySchema.safeParse(input.category);
  const facility = facilityCategorySchema.safeParse(input.facility);
  const q =
    typeof input.q === 'string'
      ? input.q.slice(0, isMapLinkInput(input.q) ? MAP_LINK_MAX_LENGTH + 1 : 200)
      : '';
  const pin = coordinatesSchema.safeParse({
    lat: typeof input.pinLat === 'number' ? input.pinLat : Number(input.pinLat),
    lng: typeof input.pinLng === 'number' ? input.pinLng : Number(input.pinLng),
  });
  return {
    ...(facility.success ? { facility: facility.data } : {}),
    ...(pin.success && withinHongKong(pin.data)
      ? { pinLat: pin.data.lat, pinLng: pin.data.lng }
      : {}),
    mode,
    ...(station.success ? station.data : {}),
    ...(place ? { place } : {}),
    ...(q ? { q } : {}),
    ...(category.success ? { category: category.data } : {}),
  };
}
