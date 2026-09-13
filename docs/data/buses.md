# KMB / Long Win bus discovery

The first bus slice uses the [official KMB / Long Win open data](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) and its [API specification](https://data.etabus.gov.hk/datagovhk/kmb_eta_api_specification.pdf). Live samples retrieved on 13 September 2026 contained 1,600 route/direction/service combinations and 6,741 stop records. Counts follow the provider and are not hard-coded coverage promises.

## Source and selection semantics

- `/route` supplies bilingual origins, destinations, direction and service type. All three route fields identify a variant; service type is not a frequency or accessibility rating.
- `/stop` supplies stop names and coordinates. `/route-stop/{route}/{direction}/{service_type}` supplies their ordered occurrences. Only a selected route's joined stops are sent to the browser. Missing coordinates, mismatched routes or incomplete sequences fail explicitly.
- `/eta/{stop_id}/{route}/{service_type}` can return both directions. The adapter filters route, direction, service and sequence. Sequence remains part of selection and the cache key because a circular route can visit a physical stop more than once.
- Null ETA remains a notice without an invented time. English and Chinese remarks are retained, including Scheduled Bus. These times must not be described as measured moving-bus positions.
- The oldest matching row's `data_timestamp` determines freshness. An empty result uses `generated_timestamp`, showing no estimates rather than claiming no service. Invalid observation times fail validation.

Stop coordinates are displayed as points; they are not route geometry, lane positions or pedestrian directions. Only the selected route is rendered, using a batched point collection and a selected-stop label. Picking a point changes the stop occurrence and ETA request.

## Cache and runtime

Routes and the global stop catalogue use one-hour process caches, with maximum 24-hour fetch retention. Route-stop and ETA caches each retain at most 128 keys. Concurrent requests for the same cache entry share a fetch. These are local process controls, not a global rate limit across Worker isolates.

ETAs poll every minute only while the bus view is active and the browser is visible. Fetch retention is two minutes and source observation retention is three minutes; the browser also expires cached observations. Catalogue downloads have a 3 MiB cap and 15-second timeout; ETA requests keep the existing 256 KiB cap and 6-second timeout. No unbounded proxy URL is accepted. Route and stop membership are checked against the catalogue before requesting ETAs.

The route picker searches bilingual origins/destinations and route numbers, showing up to 80 matches plus the current selection. Bus selection currently lasts for the current page session; bus deep links and restored selections are not implemented. Fixture mode explicitly reports that bus recordings are not configured and makes no live requests. The small dated fixture is used by deterministic tests only.

## Verification and remaining work

Tests exercise route joins, missing stops, wrong-direction data, repeated stop occurrences, scheduled and null ETAs, invalid source timestamps, request coalescing, unknown route/stop rejection, expiration and fixture isolation. Live checks and responsive browser checks supplement those tests; they do not certify every route's availability or physical Android performance.

New Lantao Bus, green minibuses, device-location search, fares, route geometry and bus deep links remain separate work. Existing MTR and camera views remain available.

Verified live on 13 September 2026: route 1A outbound returned 35 stops and scheduled arrivals; inbound loaded the opposite stop sequence. Browser clicking selected occurrence 6 and updated the picker. A 390 × 844 viewport check confirmed the selected marker and arrival/source cards remain usable. The first catalogue request timed out upstream and a subsequent retry succeeded; retry controls are provided. All 84 tests, type checking, linting, formatting and production build passed. The pre-existing Cesium bundle-size warning remains.

## Search the map area

Transport → Buses now includes **Search this map area**. The renderer resolves the map centre on the globe; on phones it uses the visible strip above the panel. This does not request device geolocation. Results are a snapshot of that area until the next search, not a continuously updating list while panning.

`/nearby?lng=…&lat=…` validates the Hong Kong study bounds, scans the shared stop catalogue and returns at most 20 stops within 800 metres, sorted by great-circle distance. Distances are rounded metres measured directly across the surface, not walking distance or proof of accessible street crossings. No new catalogue download is needed for each map area.

Selecting a result queries `/reported-routes?stop=…`, backed by the official `/stop-eta/{stop_id}` endpoint. It deduplicates route/direction/service/occurrence combinations and intersects them with the known route catalogue in the interface. It shows **reported routes**, not a complete service directory: no ETA rows is not proof that a route does not serve that stop. Selecting one opens its actual ordered stop occurrence and the existing ETA view. Unknown stop IDs are rejected before upstream requests, and reported-route caches are capped at 128 entries with the existing ETA retention policy.

Tests cover near/far and empty results, distance ordering, a dense-area cap, catalogue reuse, unknown-stop rejection and direction-preserving reported-route deduplication.

Verified live on 13 September 2026: an Austin Station result offered route 12 inbound; selecting it opened occurrence 5 with the matching stop and scheduled arrivals. A 390 × 844 browser viewport check confirmed the controls and route list remain scrollable. This is browser emulation, not a physical Android test. The expanded suite passed all 87 tests, type checking, linting and production build.

## Citybus

The operator picker now includes Citybus using its [official V2 specification](https://www.citybus.com.hk/datagovhk/bus_eta_api_specifications.pdf) and [open dataset](https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta). The API base is `https://rt.data.gov.hk/v2/transport/citybus` with company `CTB`.

- `/route/CTB` provides route endpoints. The UI offers outbound and inbound choices, swapping endpoint labels for inbound. This catalogue does not establish that both directions have stops; an empty direction is shown explicitly. The shared internal `service=1` is only a compatibility value, not a Citybus service variant, and is hidden in the UI.
- `/route-stop/CTB/{route}/{direction}` gives ordered stop IDs; `/stop/{id}` supplies names and coordinates. Citybus six-digit IDs are preserved. The backend resolves only the selected route, with four concurrent upstream requests per process and a bounded queue. Cold route loads can take longer because stop details require separate requests.
- `/eta/CTB/{stop}/{route}` can contain both directions and repeated stop occurrences. Filtering uses company, route, direction, stop ID and sequence. Null/empty ETAs remain notices; the oldest matching observation timestamp determines freshness. Missing rows do not prove no service.

The app endpoints are `/api/v1/buses/citybus/routes`, `/stops` and `/arrivals`, using the existing route query parameters. Query caches include the operator so Citybus and KMB cannot share arrivals accidentally. Catalogue entries refresh hourly with 24-hour maximum fetch retention; caches retain up to 2,048 stop details, 128 route directions and 128 arrival selections. ETAs use the same 60-second refresh and 180-second maximum source age as KMB. These are process-local caches. Fixture runtime remains explicitly unavailable; dated September 13 samples are deterministic test inputs only.

Citybus nearby-area discovery now uses the dated index described below. Citybus route geometry, fares and moving vehicle locations are not supplied by this integration.

Verified live on 13 September 2026: the Citybus catalogue returned 406 routes (812 direction choices, including potentially empty directions). Route 1 outbound loaded 20 stops and arrivals at Central (Macao Ferry). Selecting stop 2 moved the selected map marker to Rumsey Street. A 390 × 844 viewport check showed the operator control and selected marker; physical Android performance has not been re-tested for this addition. All 92 tests, type checking, linting, formatting and the production build passed. The existing Cesium bundle warning remains.

## Citybus nearby discovery

Citybus nearby search uses a dated reference index built from every catalogue route's outbound/inbound stop sequence, joined to official stop details. It does not make a city-wide request fanout when a user searches. Like KMB, results are capped at 20 within 800 metres and distances are straight-line. Only the selected operator is searched.

The index date is visible next to results. Route membership is reference data, not a live service or departure promise. Selecting an indexed route first rechecks its current stop sequence and ID; a mismatch or unavailable route stays an explicit error rather than selecting another stop at that sequence. Live ETA freshness rules then apply normally. Nearby points are listed; the map continues to show the selected route's stops.

Refresh with `node scripts/prepare-citybus-index.mjs`. The builder uses four requests concurrently, retries failures, caches successful responses for 24 hours in ignored `output/citybus-index`, and publishes `apps/api/src/data/citybus-index.json` atomically only after all route sequences and stop details validate. A failed refresh leaves the previous index intact. Rebuild/restart the app to publish a new index. This is an explicit maintenance operation, not an automatic schedule.

The full index is imported by the API only; browser responses contain the nearest 20 stops or the selected stop's indexed route memberships. Switching operators cancels an in-flight route confirmation, and only a fresh route-stop response can confirm an indexed occurrence.

Verified on 13 September 2026: the complete index contains 2,584 unique stop IDs from 406 routes. Browser search near Central returned 20 stops; choosing Rumsey Street and route 1 confirmed occurrence 2, moved the selected marker and displayed live arrivals. The narrow responsive panel was visually checked. All 94 tests, type checking, linting, formatting and production build passed; this does not certify physical Android performance.
