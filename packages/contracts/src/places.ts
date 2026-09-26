import { placeSchema, type Place } from './place';
import parks from './parks.json';

export type Category = Place['category'];

export const categoryLabels: Record<Category, string> = {
  landmark: 'Landmarks',
  park: 'Parks',
  waterfront: 'Waterfront',
  culture: 'Arts & culture',
  station: 'MTR stations',
};

// Curated discovery points, not entrance locations or a routing network.
// Source provenance and coordinate limitations live in docs/data/places.md.
export const places: Place[] = [
  {
    id: 'victoria-peak',
    name: 'Victoria Peak',
    nameZh: '太平山頂',
    district: 'Central & Western',
    category: 'landmark',
    lng: 114.1498,
    lat: 22.271,
    description: 'Explore the Peak Tower area above the city, with views across Victoria Harbour.',
    tags: ['The Peak', 'skyline', 'Peak Tower', '山頂', '凌霄閣', '中西區'],
    source: {
      name: 'Hong Kong Tourism Board',
      url: 'https://www.discoverhongkong.com/eng/place-to-go/travel.guide-the-peak-tower.html',
    },
  },
  {
    id: 'central-waterfront',
    name: 'Central Waterfront',
    nameZh: '中環海濱',
    district: 'Central & Western',
    category: 'waterfront',
    lng: 114.1644,
    lat: 22.2836,
    description: 'A harbourfront promenade connecting the Central Piers with Tamar Park.',
    tags: [
      'harbour',
      'harbor',
      'promenade',
      'Central Harbourfront',
      '海濱長廊',
      '中環',
      '維港',
      '中西區',
    ],
    source: {
      name: 'Leisure and Cultural Services Department',
      url: 'https://www.lcsd.gov.hk/en/parks/cwdpc/index.html',
    },
  },
  {
    id: 'west-kowloon-art-park',
    name: 'West Kowloon Art Park',
    nameZh: '西九藝術公園',
    district: 'Yau Tsim Mong',
    category: 'park',
    lng: 114.156,
    lat: 22.3004,
    description: 'Open lawns and a waterfront promenade in the West Kowloon Cultural District.',
    tags: ['WestK', 'WKCD', 'picnic', 'harbour', '西九', '西九文化區', '公園', '油尖旺'],
    source: {
      name: 'Hong Kong Tourism Board',
      url: 'https://www.discoverhongkong.com/eng/neighbourhoods/west-kowloon/ultimate-guide-to-west-kowloon.html',
    },
  },
  {
    id: 'm-plus',
    name: 'M+',
    nameZh: 'M+博物館',
    district: 'Yau Tsim Mong',
    category: 'culture',
    lng: 114.1595,
    lat: 22.3002,
    description: 'A museum of contemporary visual culture on the West Kowloon waterfront.',
    tags: ['M Plus', 'museum', 'art', 'WestK', 'West Kowloon', '西九', '博物館', '藝術', '油尖旺'],
    source: {
      name: 'M+',
      url: 'https://www.mplus.org.hk/en/plan-your-visit/',
    },
  },
  {
    id: 'avenue-of-stars',
    name: 'Avenue of Stars',
    nameZh: '星光大道',
    district: 'Yau Tsim Mong',
    category: 'waterfront',
    lng: 114.1731,
    lat: 22.2933,
    description: 'A Tsim Sha Tsui waterfront promenade celebrating Hong Kong cinema.',
    tags: ['Tsim Sha Tsui', 'TST', 'cinema', 'harbour', '尖沙咀', '電影', '維港', '油尖旺'],
    source: {
      name: 'Hong Kong Tourism Board',
      url: 'https://www.discoverhongkong.com/eng/place-to-go/travel.guide-avenue-of-stars.html',
    },
  },
  {
    id: 'hong-kong-park',
    name: 'Hong Kong Park',
    nameZh: '香港公園',
    district: 'Central & Western',
    category: 'park',
    lng: 114.1614,
    lat: 22.2778,
    description: 'Gardens and preserved historic buildings on Cotton Tree Drive in Central.',
    tags: ['HK Park', 'gardens', 'Central', 'Admiralty', '公園', '中環', '金鐘', '中西區'],
    source: {
      name: 'Leisure and Cultural Services Department',
      url: 'https://hkp.lcsd.gov.hk/en/visit',
    },
  },
  {
    id: 'tai-kwun',
    name: 'Tai Kwun',
    nameZh: '大館',
    district: 'Central & Western',
    category: 'culture',
    lng: 114.1542,
    lat: 22.281,
    description: 'Heritage and arts in the restored Central Police Station compound.',
    tags: ['heritage', 'art', 'Central', 'SoHo', 'Hollywood Road', '中環', '荷李活道', '中西區'],
    source: {
      name: 'Tai Kwun',
      url: 'https://www.taikwun.hk/en/taikwun/heritage_conservation/buildings',
    },
  },
  {
    id: 'pmq',
    name: 'PMQ',
    nameZh: '元創方',
    district: 'Central & Western',
    category: 'culture',
    lng: 114.1514,
    lat: 22.283,
    description:
      'Design and creative studios in the former Police Married Quarters on Aberdeen Street.',
    tags: [
      'design',
      'heritage',
      'Central',
      'SoHo',
      'Police Married Quarters',
      '中環',
      '設計',
      '中西區',
    ],
    source: {
      name: 'Hong Kong Tourism Board',
      url: 'https://www.discoverhongkong.com/eng/place-to-go/travel.guide-pmq.html',
    },
  },
  {
    id: 'admiralty-station',
    name: 'Admiralty Station',
    nameZh: '金鐘站',
    district: 'Central & Western',
    category: 'station',
    lng: 114.165,
    lat: 22.2794,
    description: 'MTR interchange in Admiralty. Select it to check Island Line arrivals.',
    tags: ['MTR', 'ADM', 'ISL', 'Island Line', '港鐵', '金鐘', '港島綫', '港島線', '中西區'],
    source: {
      name: 'MTR Corporation',
      url: 'https://www.mtr.com.hk/en/customer/services/system_map.html',
    },
    station: { line: 'ISL', code: 'ADM' },
  },
  {
    id: 'central-station',
    name: 'Central Station',
    nameZh: '中環站',
    district: 'Central & Western',
    category: 'station',
    lng: 114.1579,
    lat: 22.2819,
    description: 'MTR station in Central. Select it to check Island Line arrivals.',
    tags: ['MTR', 'CEN', 'ISL', 'Island Line', '港鐵', '中環', '港島綫', '港島線', '中西區'],
    source: {
      name: 'MTR Corporation',
      url: 'https://www.mtr.com.hk/en/customer/services/system_map.html',
    },
    station: { line: 'ISL', code: 'CEN' },
  },
  {
    id: 'tsim-sha-tsui-station',
    name: 'Tsim Sha Tsui Station',
    nameZh: '尖沙咀站',
    district: 'Yau Tsim Mong',
    category: 'station',
    lng: 114.1722,
    lat: 22.2976,
    description: 'MTR station beneath Nathan Road, served by the Tsuen Wan Line.',
    tags: ['MTR', 'TST', 'TWL', 'Tsuen Wan Line', '港鐵', '尖沙咀', '荃灣綫', '荃灣線', '油尖旺'],
    source: {
      name: 'MTR Corporation',
      url: 'https://www.mtr.com.hk/en/customer/services/system_map.html',
    },
    station: { line: 'TWL', code: 'TST' },
  },
  ...parks.places.map((place) => placeSchema.parse(place)),
];

function normalizeSearch(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      // Split mixed-script queries such as “MTR金鐘”, preserving M+ as a name.
      .replace(/([a-z0-9+])(\p{Script=Han})/gu, '$1 $2')
      .replace(/(\p{Script=Han})([a-z0-9+])/gu, '$1 $2')
      .replace(/[^\p{L}\p{N}+]+/gu, ' ')
      .trim()
  );
}

const searchIndex = places.map((place) => ({
  place,
  text: normalizeSearch(
    [place.name, place.nameZh, place.district, categoryLabels[place.category], ...place.tags].join(
      ' ',
    ),
  ),
}));

/** Every query token must match; results retain the editorial discovery order. */
export function searchPlaces(query: string, category: Category | 'all'): Place[] {
  const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return searchIndex
    .filter(
      ({ place, text }) =>
        (category === 'all' || place.category === category) &&
        tokens.every((token) => text.includes(token)),
    )
    .map(({ place }) => place);
}

export function getPlace(id: string): Place | undefined {
  return places.find((place) => place.id === id);
}
