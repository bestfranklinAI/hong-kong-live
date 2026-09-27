# Walking route planner — first integration

## Implemented

Explore → **Plan a walk** accepts two locations through the existing unified search (including coordinate pins and Google Maps links). An already selected place is used as the initial destination. The user explicitly requests Recommended, Shortest or Barrier-free directions in English or Traditional Chinese. This is a planning preview, not active navigation.

`POST /api/v1/routes` validates HK endpoints and an allowlisted profile. The provider discovers official travel-mode IDs by name rather than assuming their numbers. It requests WGS84 geometry, Z values and metre-based directions. Raw ArcGIS output is normalized into `WalkingRoute` in `packages/contracts`; no provider geometry enters preference stores.

The 2D route overview renders a **ground projection** and hides the city mesh. The experimental 3D route preview renders original source Z as ellipsoidal metres without offsets or roof clamping; limited Admiralty checks support this as a local display hypothesis, not a verified datum conversion. The original Z coordinates remain in the response, separately from any M measures. Unknown-height segments are omitted in 3D, with complete 2D coverage retained. Indoor positioning is not implemented. Selected station floor boundaries can be inspected as ground projections. Named station levels can now be chosen through their official mapped points. The service's source update time is unknown, independently of fetch time.

## Verified source audit — 26 September 2026

- [Official service documentation](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search).
- [Live travel modes](https://mapapi.hkmapservice.gov.hk/PedRoute/NAServer/route/retrieveTravelModes?f=json): Shortest Path, Barrier Free Path, Recommended Path, Stair Climbing to Health Path, Unpaid Area Preferable Path.
- The published Sung Wong Toi concourse-to-platform example succeeded without a key. Its barrier-free route contains XYZM geometry and an elevator instruction. The captured response is `fixtures/providers/landsd-route-swt-2026-09-26.json`; coordinates represent public station locations, not a user's position. It is used only in deterministic tests, not presented as a live fixture-mode route.
- [Outdoor network schema](https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637222018065_52265/MapServer/0?f=pjson) has Z. Confirmed fields include `FeatureType`, `WeatherProof`, `WheelchairBarrier`, `WheelchairAccess`, `Gradient`, `Direction`, `Enabled`, `FloorID`, `AccessTimeID`, `LevelSource` and `LastAmendmentDate`.
- `WeatherProof` distinguishes Covered, NonCovered and Unclassified. `WheelchairBarrier` codes 1/2 mean true/false; they must not be coerced as JavaScript booleans. `WheelchairAccess` describes accessible entrance connections, not blanket accessibility for every edge.
- Outdoor service also exposes access-time and floor/building relation tables. Their joins, schedule semantics, vertical datum and regional attribute completeness still require auditing.
- [Outdoor catalogue](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-pedestrian-network) lists quarterly updates; [indoor network](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-indoor-network/resource/f6e75c67-680d-4bd4-ba33-692ec181a0f0) updates as needed.

Recommended routing prefers indoor paths and discourages stairs; it is not a dedicated shelter optimizer. Official barrier-free routing does not establish current lift operation or an independently verified wheelchair journey. Unpaid-area preference is not a hard exclusion.

## Bounds, caching and privacy

- Fixed official upstream URLs only; the endpoint is not a URL proxy.
- Maximum request body 8 KiB, source route response 2 MiB, route fetch timeout 15 seconds.
- Trips limited to 15 km straight-line separation for this initial walking preview.
- Singleflight for identical requests, four concurrent solves maximum, 30 requests/minute per API instance.
- At most 64 route cache entries, valid for 30 seconds; mode metadata cached for 24 hours. Route coordinates are never written to disk or included in application logs. HTTP responses use `no-store`.
- Client cancels superseded requests and unmounts; bounded upstream work may finish to populate the shared cache.
- A horizontal connection offset over 150 m fails explicitly; offsets over 20 m produce a warning. Every result displays both offsets. These thresholds are conservative product limits, not evidence of entrance accuracy. Even a zero horizontal offset cannot resolve the wrong floor.
- Failures are not cached or replaced with straight-line routes. Fixture mode returns unavailable without querying LandsD.

## Next gates

1. Audit Central–Admiralty and selected station coverage, access-time joins, floor identifiers and Z reference system.
2. Add candidate public building entrances and floor geometry; expose unresolved floor ambiguity.
3. Render validated elevated and underground paths with floor controls and transition markers.
4. Field-check 30–50 pilot journeys, including mobility-aided journeys with relevant participants.
5. Add foreground progress and rerouting only after position uncertainty and missed-floor behavior have tests.
6. Build a versioned local graph for shelter optimization and strict exclusions if the official profiles cannot meet those needs.

No claim of improved accuracy over another navigation product, field-verified accessibility, or physical Android performance is made by this integration.

## Local verification

The mobile browser successfully searched Central Waterfront and Hong Kong Park, requested the live Recommended route and rendered the resulting path. The observed result was 1,377 m and about 23 minutes, with footbridge, station-level, stairlift and escalator instructions. This is an API/browser integration check, not confirmation that every section is currently passable. The route preview offers a summary button to reopen directions above the collapsed mobile sheet.

## Source-height inspection

The planner now provides an interactive source-Z profile. The slider exposes each returned vertex and its coordinates. Its horizontal axis is geodesic XY chainage, excludes jumps between disjoint paths and does not add vertical lift travel. Vertical edges retain the same horizontal coordinate. Missing heights break the chart rather than being filled or smoothed. No height is converted into a floor number or a street-relative elevation.

Follow-up checks of the outdoor service's `/MapServer/info/metadata` and the route service's `/NAServer/route?f=pjson` did not establish a vertical datum or Z-unit declaration. The profile therefore labels raw source Z with units/reference unverified. It is an inspection tool, not a validated elevation chart. Absolute-height city rendering remains gated on source documentation and control-point checks; XY WGS84 alone is insufficient.

## Station endpoint selection

The planner includes a station → named level → mapped point picker for either endpoint. It loads the official MTR venue catalogue (98 venues observed on 26 September 2026) and then the selected venue's amenity points. Only entry, elevator, platform, ramp, stairs and escalator categories are offered. Floor names and IDs are retained from the source, not derived from altitude. Levels without these points are not listed. The picker loads floor boundaries separately and never computes an invented floor-centre destination.

The Sung Wong Toi sample contains six distinct named levels and 61 eligible mapped points. Its Exit A entry point is on the concourse, while Exit A Ground Level has separate transition points. This distinction is visible in the picker. A source entry marker is not necessarily a street entrance; generic lift points can share a name, so coordinates and numbered map markers distinguish them.

Endpoints carry venue and point UUIDs. Before solving, the API resolves these against the current cached official catalogue and replaces submitted coordinates, height and name. Point geometry Z must agree with source level Z within 0.25 source units. An indoor route endpoint with missing height or a difference greater than one source unit is rejected. This checks height consistency, not exact floor identity or accessibility. Both tolerances are application guards, not surveyed accuracy claims. Using source Z with the source router does not establish its alignment with the city mesh.

- `GET /api/v1/routes/indoor/stations`
- `GET /api/v1/routes/indoor/stations/:uuid/points`
- Fixed WFS feature URLs and UUID-only station filters; no arbitrary queries.
- Six-hour cache, at most 32 catalogue entries and four pending requests, singleflight per catalogue key. WFS responses are bounded at 6 MiB/20 seconds; 5,000-record responses are rejected as potentially truncated.
- Fixture mode does not fetch live indoor data. Publication timestamps are unknown; fetch dates are shown separately.
- [Official indoor MTR API](https://tools.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map) documents station-by-station requests. Public sample records are saved in `fixtures/providers/landsd-*-swt-2026-09-26.json` for deterministic normalization tests; the venue fixture omits unused polygon geometry.

Physical route checks, building interiors outside MTR, lift availability, paid-area exclusion and automatic indoor positioning remain unimplemented.

Live mobile verification: Sung Wong Toi Concourse Level / Exit A → Platform Level / Platform 1 returned a 123 m barrier-free-profile route with an elevator instruction. Both route ends matched the selected source heights and rounded horizontal offsets were 0 m. This verifies the integration only, not current lift availability or physical passage.

Map inspection: choose a station, level and point type, then **Choose on map**. Numbered 44 px markers show only the selected level and reuse the loaded catalogue. A selected marker opens a confirmation card before changing the endpoint. The numbered list remains available for keyboard access and overlapping points. Changing the station, level or category, or closing the picker, clears the map selection. The city mesh is hidden during selection; points are explicitly labelled as ground projections, not physically aligned indoor heights.

Map-picker verification: typecheck, lint, 154 tests and production build passed. Browser inspection confirmed marker framing, the level label, return-to-list and endpoint selection through the numbered fallback. Automated native canvas taps did not produce a selection in this browser session; the marker confirmation interaction still needs a physical touch check.


## Selected floor boundaries

The map picker retrieves `mtr_level_polygon` venue by venue through `GET /api/v1/routes/indoor/stations/:uuid/floors`. A live Sung Wong Toi response on 26 September 2026 contains six Polygon features; their level IDs match the existing points. The captured response is `fixtures/providers/landsd-mtr-levels-swt-2026-09-26.json` for tests only. The adapter also accepts MultiPolygon geometry, preserves all rings and source XYZ, rejects mixed venues, duplicate IDs, unclosed rings and conflicting level Z, and limits total geometry to 100,000 vertices within the existing 6 MiB response budget.

Floor and point responses have separate cache keys in the bounded six-hour catalogue cache. The browser reuses six-hour query results and cancels obsolete requests. Floor lookup failure leaves point selection available, with an explicit unavailable message and retry. Only the chosen level's outline is rendered, with white edging and a purple boundary legend. Changing or closing the picker clears its geometry. The camera fits the boundary and selected point category together.

Boundaries are projected to the flat map. They are not walkability polygons, room layouts, paid-area boundaries or proof of a connection between levels. Lift, stairs, escalator and ramp points have explicit type labels; the confirmation explains that their connected levels and current availability are unconfirmed. Actual connectivity comes from the route service, not proximity or matching names. Unit polygons, opening lines and aligned 3D floor rendering remain future work.

Verification for floor outlines: typecheck, lint, 159 tests and production build passed. In the live browser, switching Sung Wong Toi from Concourse / Exits to Platform / Lifts replaced the concourse boundary and six markers with the platform boundary and one lift marker. Screenshots are in ignored `output/playwright/indoor-concourse-outline.jpg` and `indoor-platform-outline.jpg`. Native automated marker taps still did not produce a selection; physical touch confirmation remains outstanding. No physical accessibility or indoor position validation is claimed.

## Optional unit boundaries and openings

Enable **Show unit boundaries and openings** in the station picker to request `/api/v1/routes/indoor/stations/:uuid/layout`. This fetches only the selected venue's official `mtr_unit_polygon` and `mtr_opening_line` layers, using separate bounded six-hour cache entries and shared in-flight requests. Requests are cancellable in the browser and failures leave the existing points and floor outline usable. Geometry retains source XYZ and level IDs; duplicate IDs, foreign venues, invalid shapes, open polygon rings and level-height conflicts are rejected. Each layer is capped at 100,000 vertices and the existing 6 MiB / 20-second limits.

Sung Wong Toi live responses captured on 26 September 2026 contain 85 units and 195 openings, including six service openings. These public samples are stored as test fixtures, never silently substituted for live data. The renderer displays grey unit boundaries and teal openings for the selected floor only, above the ground-projected purple floor outline. No fill implies traversable space; openings do not assert public access, an unlocked door, or working accessibility equipment. Source access metadata is frequently null. Floor geometry is required to render detail on that level.

The map card now includes a labelled point selector for crowded markers and keyboard use. It shows the same preview and explicit **Use this point** action as marker selection.

Route-linked automatic floor switching remains gated: the current route response retains instruction text but no explicit per-step floor IDs. Matching a floor from a name or elevation alone would introduce ambiguity. Unit layouts and opening lines are not used to invent routing connectivity.

Layout verification: the live Sung Wong Toi concourse loaded its unit/opening layer and four lift points. Selecting lift 2 in the map card and confirming **Use this point** populated the starting endpoint with the concourse lift, then cleared the picker. The renderer test verifies that other-level detail is excluded, source Z is not mutated, and clearing removes all detail. Automated canvas selection remains unverified; the explicit map-card selector provides a tested alternative. The longer map legend is expandable to preserve mobile map space.

## Point selection feedback

Indoor marker selection now checks the projected 44 px target before general GPU object picking. Overlapping targets choose the nearest marker centre; the numbered selector remains the unambiguous alternative. Selected markers grow by 20% and change to teal with a gold outline, retaining their number. Selection updates existing billboards without recreating floor geometry or moving animation frames into React state. Mobile framing observes the map card rather than only the collapsed discovery sheet, so confirmation content does not cover the points.

Tests cover target edges, selection/reset styling and clearing stale points. Automated native canvas taps have not yet demonstrated end-to-end selection in the in-app browser; the change is not claimed as a verified fix for physical Android touch. The card selector and endpoint confirmation remain available.

Latest source-consistency audit: [Sung Wong Toi, 26 September 2026](audits/swt-routing-2026-09-26.md). Three barrier-free journeys returned matching endpoint coordinates/heights; ground/platform routes included two lift instructions. This does not certify physical access. The audit also records the network build timestamp separately and confirms that no explicit per-step floor IDs were observed in the inspected raw response.

The follow-up [Admiralty audit](audits/admiralty-routing-2026-09-26.md) checks four journeys and tests floor candidates offline. All endpoint checks passed. XY alone is often ambiguous; source Z disambiguates sampled vertices but not all segment interiors. No automatic floor-switching behavior was added. Reproduce the geometry analysis with `python3 scripts/audit-admiralty-floors.py`.

## Navigation visual presentation

Navigation offers 2D overview and experimental 3D source-height geometry. Optional translucent teal dashes show depth-obscured sections; these indicate occlusion, not an indoor classification. Switching this option preserves the camera. Endpoint dots use actual route endpoint heights. The source instruction model has no per-step coordinates, so stairs/lift symbols remain in the directions instead of receiving invented map locations. Regression tests cover height preservation, vertical links, missing-height gaps, view changes and cleanup.

Routes with official indoor endpoints expose **View station floor plan**. This separate north-up plan renders one selected official level, preserves polygon holes, and displays unit boundaries, mapped openings and selectable points with a dropdown alternative for overlap. It defaults to the endpoint's source level and clears point selection on level change. It does not assign route segments to floors or infer connected lift levels. Missing floor/layout data is explicit. Routes without an identified station endpoint retain directions and a coverage message rather than guessing the station.

Mobile browser verification at 390 × 844 used a live 230 m Admiralty route: E1 ground plan, ramp selection, East Rail level change, and switching to 3D city context with the route hidden. Physical Android usability and automatic indoor/outdoor route segmentation remain unverified.

Station point markers now share vector symbols with the point list: lift, stairs, escalator, ramp, entry and platform. Number badges remain for correspondence with the accessible selector; selected-marker styling and 44 px targets are preserved. Directions use a numbered timeline, with explicit transition instructions emphasized and a summary counting instruction mentions, not distinct pieces of equipment. Symbols are presentation hints based on conservative English/Traditional Chinese wording recognition; original source text is retained, unknown wording stays a walking card, and no level identity or equipment availability is inferred. The source-height profile is expandable to keep primary directions easier to scan.

Browser verification at 390 × 844: direct tap on the lift marker opened its preview, and confirmation set the endpoint. This supersedes the earlier inability to demonstrate native canvas selection in the previous tab; physical Android testing remains separate.

A live barrier-free request from Sung Wong Toi platform lift to concourse Exit A returned a 94 m route with 12 instructions, including one lift instruction. The mobile timeline rendered the lift as an emphasized card while retaining the provider text. Typecheck, lint, all 164 tests and production build passed; existing bundle-size warnings remain.

### Direct station map access

Explore station detail cards now offer **View indoor map**, without entering the walking planner. The popup matches the selected station to one unique official catalogue name (English or Chinese, ignoring station suffixes); ambiguous or missing matches show an unavailable message. It loads the station floor plan on demand, defaults to the named concourse where present, and lets users choose a mapped point as **Start here** or **Directions here**. The planner retains that point's venue ID, point ID and source Z for backend validation. Desktop uses a large dialog; mobile uses a bottom-anchored scrolling dialog. This is a floor-plan browser, not automatic indoor position tracking. Browser checks covered Admiralty level switching, origin handoff and destination handoff at 390 × 844. Physical Android testing is separate.
