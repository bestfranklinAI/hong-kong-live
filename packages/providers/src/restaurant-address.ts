import { normalizeSearchText, type SearchResult } from '@hk/contracts';

function canonicalAddress(value: string) {
  return value
    .toUpperCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\bRD\.?\b/g, 'ROAD')
    .replace(/\bST\.?\b/g, 'STREET')
    .replace(/\bAVE\.?\b/g, 'AVENUE')
    .replace(/\bBLDG\.?\b/g, 'BUILDING');
}

function streets(value: string) {
  return [
    ...canonicalAddress(value).matchAll(
      /\b(\d+[A-Z]?)(?:\s*-\s*(\d+[A-Z]?))?\s+([A-Z][A-Z0-9' .-]*?\b(?:STREET|ROAD|AVENUE|LANE|PATH|DRIVE|TERRACE|CIRCUIT|CRESCENT|HIGHWAY|WAY)(?:\s+(?:EAST|WEST|NORTH|SOUTH))?)\b/g,
    ),
  ].map((match) => ({
    from: match[1],
    to: match[2] ?? match[1],
    name: normalizeSearchText(match[3]),
  }));
}

/** A range can identify a building, never a shop entrance or floor. */
export function matchRestaurantAddress(restaurant: SearchResult, candidates: SearchResult[]) {
  const wanted = streets(restaurant.address);
  const original = normalizeSearchText(canonicalAddress(restaurant.address));
  const matches = candidates.filter((candidate) => {
    if (!candidate.location) return false;
    const district = normalizeSearchText(candidate.district)
      .replace(/\bdistrict\b/g, '')
      .trim();
    if (
      district &&
      restaurant.district &&
      !normalizeSearchText(restaurant.district).includes(district)
    )
      return false;
    const offered = streets(candidate.address);
    if (wanted.length && offered.length)
      return wanted.some((a) =>
        offered.some((b) => {
          if (a.name !== b.name) return false;
          if (a.from === b.from && a.to === b.to) return true;
          if (a.from !== a.to || /[A-Z]/.test(a.from + b.from + b.to)) return false;
          const number = Number(a.from),
            low = Number(b.from),
            high = Number(b.to);
          return (
            number >= low && number <= high && (low % 2 !== high % 2 || number % 2 === low % 2)
          );
        }),
      );
    const address = normalizeSearchText(canonicalAddress(candidate.address));
    return /\d/.test(address) && address.length >= 12 && ` ${original} `.includes(` ${address} `);
  });
  const locations = new Map(
    matches.map((row) => [`${row.location!.lat.toFixed(5)},${row.location!.lng.toFixed(5)}`, row]),
  );
  return locations.size === 1 ? [...locations.values()][0] : undefined;
}

/** Remove unit/floor prefixes, preserving building and street context. */
export function restaurantAddressQuery(address: string) {
  const parts = address.split(',').map((part) => part.trim());
  while (
    parts.length > 1 &&
    /^(?:SHOP|UNIT|STALL|ROOM|FLAT|GROUND FLOOR|(?:G|LG|UG|B|\d+[A-Z]?(?:-\d+[A-Z]?)?)\s*\/F|[\d\s-]+(?:ST|ND|RD|TH)? FLOOR|LEVEL|BASEMENT)/i.test(
      parts[0],
    )
  )
    parts.shift();
  return canonicalAddress(parts.join(', ')).slice(0, 200);
}

export const restaurantAddressKey = (address: string) =>
  normalizeSearchText(restaurantAddressQuery(address));
