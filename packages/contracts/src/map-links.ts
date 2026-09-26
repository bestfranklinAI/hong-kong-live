import { z } from 'zod';
import { searchResultSchema } from './search';

export const MAP_LINK_MAX_LENGTH = 8192;
/** Keep URL-looking input out of ordinary address lookup, including unsupported hosts. */
export function isMapLinkInput(value: string) {
  return /^(?:https?:\/\/|www\.|maps\.|goo\.gl\/|google\.)/i.test(value.trim());
}
export const mapLinkResponseSchema = z.object({
  result: searchResultSchema.nullable(),
  coordinateKind: z.enum(['place', 'map-centre']).nullable(),
  message: z.string(),
});
export type MapLinkResponse = z.infer<typeof mapLinkResponseSchema>;
