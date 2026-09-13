import {
  categorySchema,
  stationSelectionSchema,
  type Category,
  type ViewMode,
} from '@hk/contracts';
import { getPlace } from '../features/explore/places';

export interface AtlasSearch {
  mode: ViewMode;
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
  const q = typeof input.q === 'string' ? input.q.slice(0, 80) : '';
  return {
    mode,
    ...(station.success ? station.data : {}),
    ...(place ? { place } : {}),
    ...(q ? { q } : {}),
    ...(category.success ? { category: category.data } : {}),
  };
}
