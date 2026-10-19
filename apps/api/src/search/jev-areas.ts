import { normalizeSearchText, places } from '@hk/contracts';

// Labels identify requested search areas, never positions, boundaries or route connections.
const areas: [string, ...string[]][] = [
  ['Central & Western', '中西區'],
  ['Eastern', '東區'],
  ['Southern', '南區'],
  ['Wan Chai', '灣仔'],
  ['Kowloon City', '九龍城'],
  ['Kwun Tong', '觀塘'],
  ['Sham Shui Po', '深水埗'],
  ['Wong Tai Sin', '黃大仙'],
  ['Yau Tsim Mong', '油尖旺'],
  ['Islands', '離島'],
  ['Kwai Tsing', '葵青'],
  ['North', '北區'],
  ['Sai Kung', '西貢'],
  ['Sha Tin', '沙田'],
  ['Tai Po', '大埔'],
  ['Tsuen Wan', '荃灣'],
  ['Tuen Mun', '屯門'],
  ['Yuen Long', '元朗'],
  ['Central', '中環'],
  ['Admiralty', '金鐘'],
  ['West Kowloon', '西九', '西九龍', '西九文化區'],
  ['Tsim Sha Tsui', '尖沙咀'],
  ['Jordan', '佐敦'],
  ['Mong Kok', '旺角'],
  ['Causeway Bay', '銅鑼灣'],
  ['Sheung Wan', '上環'],
  ['North Point', '北角'],
  ['Tung Chung', '東涌'],
];

const mentions = (query: string, alias: string) => {
  const name = normalizeSearchText(alias);
  return /\p{Script=Han}/u.test(name) ? query.includes(name) : ` ${query} `.includes(` ${name} `);
};

export function jevAreaCandidates(query: string) {
  const normalized = normalizeSearchText(query);
  const matches = areas.filter((aliases) => aliases.some((alias) => mentions(normalized, alias)));
  if (matches.length) return [...new Set(matches.map(([name]) => name))].slice(0, 12);
  return [
    ...new Set(
      places
        .filter((place) => mentions(normalized, place.name) || mentions(normalized, place.nameZh))
        .map((place) => place.name),
    ),
  ].slice(0, 12);
}
