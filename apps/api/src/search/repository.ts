import { normalizeSearchText, type SearchResult, type CatalogueStatus } from '@hk/contracts';
export interface SearchRepository {
  search(query: string, limit: number): SearchResult[];
  nearby(lat: number, lng: number, limit: number): SearchResult[];
  get(id: string): SearchResult | undefined;
  status(now: number): CatalogueStatus;
  locate(id: string, address: string, match: SearchResult | undefined, now: number): void;
}
export const emptyRepository: SearchRepository = {
  nearby: () => [],
  search: () => [],
  get: () => undefined,
  locate: () => {},
  status: () => ({
    sourceDate: null,
    fetchedAt: null,
    importedAt: null,
    count: 0,
    resolved: 0,
    stale: true,
  }),
};
export function rankResult(row: SearchResult, query: string) {
  const q = normalizeSearchText(query);
  const names = [row.name, row.nameZh].map(normalizeSearchText);
  if (names.includes(q)) return 100;
  if (names.some((name) => name.startsWith(q))) return 80;
  if (names.some((name) => name.includes(q))) return 60;
  return 20;
}
