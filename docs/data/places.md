# Curated discovery places

Verified against the linked official sources on 13 September 2026. The catalogue contains 47 places across all 18 districts: the original eleven editorial entries plus 36 selected LCSD parks and waterfront spaces. It is a small editorial discovery collection, not a complete government place index or live travel guide.

The application data is in `apps/web/src/features/explore/places.ts`. Each record contains a stable URL-safe ID, English and Traditional Chinese names, a category, a short original description, bilingual search aliases, a navigation coordinate and its official reference. The three MTR records also select a specific line/station pair for the arrival adapter; they do not enumerate every line serving that station.

## Sources and coordinate meaning

Coordinates are manually selected, approximate WGS84 longitude/latitude positions for framing the map. They are **not** official entrance points, routing nodes, surveyed building positions or accessibility information. The Peak record frames its visitor area near the Peak Tower, not Victoria Peak's geographic summit. Station markers approximate station centres and must not be used to direct someone to a particular exit.

| Record                | Official reference                                                                                                                            | Navigation focus                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Victoria Peak         | [Hong Kong Tourism Board: Peak Tower](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-the-peak-tower.html)                      | Peak Tower visitor area                              |
| Central Waterfront    | [LCSD: Central and Western District Promenade, Central Section](https://www.lcsd.gov.hk/en/parks/cwdpc/index.html)                            | Promenade between the Central Piers and Tamar        |
| West Kowloon Art Park | [Hong Kong Tourism Board: West Kowloon](https://www.discoverhongkong.com/eng/neighbourhoods/west-kowloon/ultimate-guide-to-west-kowloon.html) | Art Park open space                                  |
| M+                    | [M+: Plan your visit](https://www.mplus.org.hk/en/plan-your-visit/)                                                                           | Museum building                                      |
| Avenue of Stars       | [Hong Kong Tourism Board: Avenue of Stars](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-avenue-of-stars.html)                | Waterfront promenade                                 |
| Hong Kong Park        | [LCSD: Visit Hong Kong Park](https://hkp.lcsd.gov.hk/en/visit)                                                                                | Park interior                                        |
| Tai Kwun              | [Tai Kwun: Building history](https://www.taikwun.hk/en/taikwun/heritage_conservation/buildings)                                               | Heritage compound                                    |
| PMQ                   | [Hong Kong Tourism Board: PMQ](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-pmq.html)                                        | Former Police Married Quarters compound              |
| Admiralty Station     | [MTR: System and station maps](https://www.mtr.com.hk/en/customer/services/system_map.html)                                                   | Approximate station centre; arrivals use `ISL / ADM` |
| Central Station       | [MTR: System and station maps](https://www.mtr.com.hk/en/customer/services/system_map.html)                                                   | Approximate station centre; arrivals use `ISL / CEN` |
| Tsim Sha Tsui Station | [MTR: System and station maps](https://www.mtr.com.hk/en/customer/services/system_map.html)                                                   | Approximate station centre; arrivals use `TWL / TST` |

Descriptions omit opening hours, admission prices, closures and accessibility claims because those need their own current, authoritative source. External links let visitors check the venue's information. No photographs, web-page text blocks or live data have been copied into this catalog. This file records provenance; it is not an assertion that an entire linked website has an open-data licence.

## Search behaviour

- Normalize Unicode compatibility characters and accents, then lowercase. Full-width `Ｍ＋` therefore finds M+, and `táï kwún` finds Tai Kwun.
- Preserve `+` because it distinguishes the museum name. Search tags include `M Plus` as an alternative.
- Separate adjacent Latin and Chinese text so `MTR金鐘` and `尖沙咀MTR` work without spaces.
- Require every token to appear in the name, Chinese name, district, category label or alias index. Matching is substring-based, not fuzzy, ranked or semantic.
- Apply the category as a further filter, retaining the editorial order. A blank query returns all records in that category.
- Keep saved-place filtering separate in the interface. Search never silently changes its meaning based on local bookmarks.

Districts are searchable. For example, `central` also matches the `Central & Western` district of Admiralty. Traditional Chinese names and a few explicit aliases are supported; this is not general Traditional/Simplified Chinese conversion. A later official geocoder should be visibly distinguished from these curated results rather than silently expanding the catalog.

## Maintenance

Keep existing IDs stable so saved places and shared URLs remain valid. When adding a place, verify the primary source, choose an honest map focus, add both names and useful aliases, and check that its classification is suitable. Add a regression case when a new alias or normalization rule solves a real search failure. An official entrance/routing dataset should be modelled separately with its coordinate provenance and accessibility attributes.

## LCSD expansion

The 36 additions are prepared from the official [Parks, Zoos and Gardens dataset](https://data.gov.hk/en-data/dataset/hk-lcsd-csdi-parks-zoos-gardens), retrieved on 13 September 2026. `parks.json` retains the query URL, preparation time, original source object IDs and per-record update timestamps. English/Traditional Chinese names, districts, addresses and WGS84 coordinates come from the source. Unlike the original eleven manually framed points above, these additions use the provider's `LONGITUDE` and `LATITUDE` fields. They remain venue reference positions, not verified entrances.

The source returned 122 records. The importer requires exactly one match for each of 36 reviewed names and rejects truncated responses or coordinates outside Hong Kong. Duplicate-name entries such as Wan Chai Gap Park, source district values such as FANLING, and overlapping existing destinations were not selected. IDs derive from the reviewed names and must remain stable when refreshing. The selection covers parks and waterfronts, not a complete tourist attraction directory.

Run `python3 scripts/prepare-explore-parks.py <downloaded-response.json>` to reproduce the catalogue using the query recorded in `parks.json`. Descriptions use only district and address information. Opening hours, facility availability and closure notices are intentionally not presented as live information. The generated records pass the shared place schema before entering search. Existing bookmarks and IDs are unchanged.

The map retains batched markers; unselected place labels appear only within 6 km camera distance to reduce overlap. The selected label remains visible. District names and Chinese source addresses are indexed for discovery without extra network requests.
