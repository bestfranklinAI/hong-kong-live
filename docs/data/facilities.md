# Public facilities

Explore includes sports centres, libraries (including mobile-library stops), and water refill points. Category chips select a map layer; markers group at wider views and separate as the camera approaches. Selecting a record opens its bilingual details, source link, and available hours or location instructions. The same records participate in unified text and nearby search.

## Official sources

All four are CSDI point services. The adapter requests GeoJSON with `outSR=4326`, uses the returned geometry, and rejects coordinates outside the Hong Kong study extent.

| Source | CSDI dataset ID | Verified records, 26 September 2026 |
| --- | --- | ---: |
| [LCSD sports centres](https://data.gov.hk/en-data/dataset/hk-lcsd-csdi-sports-centres) | `lcsd_rcd_1629267205215_31341` | 106 |
| [LCSD libraries](https://data.gov.hk/en-data/dataset/hk-lcsd-csdi-libraries) | `lcsd_rcd_1629267205214_44807` | 184 |
| [LCSD water dispensers](https://data.gov.hk/en-data/dataset/hk-lcsd-facwd-fac-wd-list) | `lcsd_rcd_1671530248519_33416` | 1,040 |
| [AFCD filling stations](https://data.gov.hk/en-data/dataset/hk-afcd-afcdlist-water-dispenser) | `afcd_rcd_1635133835075_48993` | 37 |

The query endpoint is `https://portal.csdi.gov.hk/server/rest/services/common/{dataset}/MapServer/0/query`. Counts are source location records, not necessarily unique venues or individual dispenser units. Separate installations at one venue are retained. Library records include mobile stops and self-service stations.

## Refresh and persistence

The Node API imports in the background at startup and checks hourly for snapshots older than 24 hours. This is our check interval, not a claim about the publisher's update frequency. LCSD's dispenser catalogue is published annually; AFCD updates as needed. A source can remain unchanged across many checks.

Snapshots are stored under `.data/facilities` relative to the API process working directory, or `HK_FACILITIES_DIR` when configured. Preserve this directory on a VM to avoid downloading every source after a restart. Writes are atomic. Count-checked pagination, duplicate detection and a large-drop guard prevent incomplete imports from replacing the last successful snapshot. Failures retain that snapshot and mark it stale; a failed initial import remains unavailable. Shutdown cancels pending requests. Fixture mode does not download these catalogues.

`GET /api/v1/search/facilities` returns records and per-source readiness, record counts and fetch timestamps. Geographic data stays in the query cache and renderer rather than the UI preference store. Lists render 30 records at a time; marker grouping updates after camera movement, outside React animation state.

## Evidence and limits

- `sourceDate` uses the actual row `LASTUPDATE` where supplied. Missing publication timestamps remain null; fetch time is kept separately.
- Coordinates are reference points, not verified entrances, floor positions, or indoor navigation coverage.
- Published schedules are not live open/closed status. Bookings, dispenser working status and queue lengths are unavailable.
- Automated checks cover normalization, pagination, failure retention, unified search and nearby search. Mobile-layout browser checks do not establish physical Android performance.
- Trails, EV charging, clinics and census overlays are separate future integrations.
