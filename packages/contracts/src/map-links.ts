import { z } from 'zod';
import { searchResultSchema } from './search';

export const MAP_LINK_MAX_LENGTH = 8192;
/** Keep URL-looking input out of ordinary address lookup, including unsupported hosts. */
export function isMapLinkInput(value: string) {
  return /https?:\/\//i.test(value) || /^(?:www\.|maps\.|goo\.gl\/|google\.)/i.test(value.trim());
}
/** Android sharing can include a place label before its link. Require one unambiguous URL. */
export function extractMapLink(value: string) {
  const matches = value.match(/https:\/\/[^\s<>]+/gi) ?? [];
  if (matches.length !== 1) return value.trim();
  return matches[0];
}
export const mapLinkResponseSchema = z.object({
  result: searchResultSchema.nullable(),
  coordinateKind: z.enum(['place', 'map-centre']).nullable(),
  place: z
    .object({ name: z.string().max(1000), address: z.string().max(3000), url: z.url() })
    .optional(),
  candidates: z.array(searchResultSchema).max(8).default([]),
  message: z.string(),
});
export type MapLinkResponse = z.infer<typeof mapLinkResponseSchema>;
