# Unified place search

The shared search box accepts English/Chinese names, addresses, MTR stations and decimal latitude/longitude, such as `22.3011308, 114.1833802`. Geoapify and Google Places are not integrated.

## Google Maps share links

Paste a Google Maps HTTPS link into the same box, choose **Resolve Google Maps link**, then select the extracted pin. This uses `POST /api/v1/search/links/resolve` with `{ "url": "..." }`; no Google API key is needed. Direct coordinate links are parsed without contacting Google. Short links on `maps.app.goo.gl` and legacy `goo.gl/maps` follow up to six HTTP redirects with an eight-second total timeout. Every hop is restricted to exact supported Google hosts and Maps paths; bodies are cancelled, and scripts, cookies, arbitrary URLs and page scraping are not used.

Supported full-link hosts are `google.com`, `www.google.com`, `maps.google.com` and their `.com.hk` equivalents. Coordinate queries (`q`, `query`), embedded `!3d…!4d…` place coordinates, and map-centre coordinates (`@`, `center`, `ll`) are recognized. The embedded share format is best-effort, not a stable Google API. Map-centre and place-ID fallback coordinates are explicitly labelled for confirmation. Directions, ambiguous multiple locations, unresolved place IDs, HTML-only short-link landing pages and points outside the study area show a coordinate-paste fallback.

Google documents coordinate query and map-centre parameters in its [Maps URLs guide](https://developers.google.com/maps/documentation/urls/get-started). On 2026-09-26, the public Café Lagoon short link listed in the [Q-Mark directory](https://www.qmark.org.hk/download/licensee/halal.pdf) resolved through this backend to `22.3716904, 113.9896697`. This verifies one live redirect flow, not every Google share-link variant.

The resolver is limited to 20 requests per minute and four concurrent resolutions per API process. Links are bounded to 8,192 characters and are not stored in a server-side cache. Like other searches, the input currently appears in the local app URL until a result is selected; avoid sharing that URL if the pasted link is private. Fixture mode makes no link-resolution requests. Google can change share-link behavior, so not every shared link can be resolved.

## Sources and persistence

- Curated places and MTR station references are shared through `packages/contracts`.
- FEHD restaurant licences come from the [English XML](https://www.fehd.gov.hk/english/licensing/license/text/LP_Restaurants_EN.XML) and [Chinese XML](https://www.fehd.gov.hk/tc_chi/licensing/license/text/LP_Restaurants_TC.XML). Both snapshots must have matching dates and licence IDs before publication. FEHD publishes daily at 09:00 HKT; the running Node API checks for a new snapshot after 09:30 HKT, retrying failures hourly. Last-good data survives a failed refresh.
- [LandsD location search](https://tools.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) supplies address results. HK80 coordinates are transformed to WGS84. The client serializes requests, caches answers, bounds its queue and caps requests at 1,000 per UTC day per process. This is a protective application limit, not a provider quota; restarting resets it.

Node 24 stores the bilingual restaurant index in `.data/search.sqlite` by default. Set `HK_SEARCH_DB` to an absolute writable persistent path for a deployed VM. Keep that directory across deployments; do not expose it through the web server. Stop the API before copying the database and its WAL files for a filesystem backup, or use SQLite backup tooling. Multiple API instances should not each run their own independent collector.

To import immediately:

```sh
pnpm --filter @hk/api import:restaurants
```

The API imports automatically on first startup when needed. The collector runs only while the Node API is running; no external cron service is installed. Fixture mode does not download a restaurant catalogue. The fetch-only application entry point can accept an injected repository; SQLite collection requires the Node server.

## Accuracy and coverage

FEHD records contain names, licence details and addresses, **not coordinates, opening hours, reviews or a complete list of attractions**. Licence validity does not establish that a venue is currently open.

Up to 100 unresolved addresses are considered for background matching each daily cycle. Selecting an unresolved restaurant also requests a match. Automatic acceptance requires a unique numbered-address match; district-only and ambiguous results remain unresolved. Accepted coordinates identify an approximate address/building, not a surveyed restaurant entrance. Possible alternatives require user selection and retain the address result's identity.

Nearby search covers about 2 km and excludes unresolved restaurants. Its initial coverage is therefore limited. Chinese short queries use substring matching; longer tokens use the SQLite trigram index. Ranking is lexical, not semantic or typo correction.

## API and pins

- `GET /api/v1/search?q=...&language=en&limit=12`: common response with results, source notices and catalogue freshness. Limit 1–20; query 1–200 characters.
- `GET /api/v1/search?q=nearby:%2022.3011308,%20114.1833802`: nearby known locations.
- `POST /api/v1/search/restaurants/fehd:LICENCE_NUMBER/locate`: resolve only an existing catalogue record. No arbitrary URL proxying.

The API applies a shared per-process limit of 120 search/locate requests per minute. Responses are `no-store`; queries may contain coordinates. Avoid enabling query-string access logs on a reverse proxy.

Coordinate parsing works locally even when the API is unavailable. Coordinates outside the Hong Kong study extent are rejected; an unambiguous longitude-first pair is offered for confirmation. Map URLs retain coordinate pins. Saved pins are stored only in that browser's local storage (maximum 50); they do not sync to another device. Selecting a saved or restored coordinate does not infer a restaurant identity.

## Verification

Tests cover coordinate validation, bilingual XML joining, malformed snapshots, HK80 conversion, conservative matching, SQLite search/publication, nearby filtering, partial source failures, request coalescing and the HKT refresh boundary. Browser checks complement these tests; physical Android responsiveness and territory-wide address-match coverage require separate measurement.
