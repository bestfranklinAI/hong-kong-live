# Pedestrian network experiments and product recommendation

19 October 2026. Public-source experiments, with no user GPS, credentials, production feature changes or whole-territory download.

**Recommendation: keep the government solver, use more of its response, and add bounded network data for specific user questions. A separate routing engine is premature for the current app.** Direct experiments show that the existing solver accepts useful customization beyond the three profiles exposed in our app.

## What was exercised

The reproducible probe captures service/layer schemas, small spatial queries, relation tables and ten route responses. The final [machine-readable report](pedestrian-network-experiments-2026-10-19.json) references 35 captured responses with public request URLs, capture timestamps and data hashes. Raw responses remain in ignored `output/playwright/network-probe/`.

- Two network layers: the general 3D Pedestrian Network and separate 3D Indoor Network.
- Central, Admiralty and Kowloon boxes, plus smaller Central/Admiralty boxes to obtain untruncated local results.
- Access-time headers, day/time details and floor relations, including joins from actual sampled edge IDs.
- Four built-in route profiles; a JSON shortest-mode control; a custom cover preference; an invalid-restriction control; two alternative direction styles; a point barrier.
- One public reference journey: Central Waterfront `(114.1644, 22.2836)` to Hong Kong Park `(114.1614, 22.2778)`. These are catalogue reference points, not confirmed entrances.

This is a source/API feasibility audit. It does not measure phone performance, validate physical passages or establish that a suggested route is more comfortable.

## 1. The graph data is genuinely useful

The queried line layer returns XYZ geometry and attributes for path type, shelter, wheelchair barriers, entrance accessibility, obstacles, gradient, direction, enabled state, floor references, access-time references and amendment dates. Coded domains distinguish footbridges, subways, lifts, ramps, staircases, escalators, travelators and crossing types.

One complete Admiralty box, approximately 310 × 334 m, returned:

| Observation                           | General network service | Indoor network service |
| ------------------------------------- | ----------------------: | ---------------------: |
| Edge records intersecting the box     |                     816 |                    835 |
| Recorded covered                      |                     499 |                    835 |
| Recorded uncovered                    |                     310 |                      0 |
| Shelter unclassified                  |                       7 |                      0 |
| Staircase edge records                |                      45 |                     60 |
| Lift edge records                     |                      11 |                     15 |
| Records with a floor reference        |                     182 |                    835 |
| Records with an access-time reference |                     272 |                      0 |
| Source Z range                        |          -6.5 to 33.6 m |         -33.6 to 6.2 m |

These are **edge records, not distinct lifts/stairs, graph nodes or complete equipment counts**. The general network service itself contains some `Location=Indoor` records; the service name is not a physical indoor/outdoor classifier. Layers must not be blindly concatenated as a deduplicated graph.

The smaller Central box returned 569 general-network and 839 indoor-network records without truncation. All six larger queries hit the experiment's 1,200-record cap and reported `exceededTransferLimit=true`. Their counts and distributions describe ordered samples, not whole areas. A production layer needs bounded queries, explicit pagination/truncation handling, caching and a zoom threshold.

Both layer schemas declare **Hong Kong Principal Datum, gravity-related height, metres**, with horizontal source CRS HK1980 Grid. The query transforms XY to WGS84. This is useful new evidence for the raw network dataset; it does not establish that every solver response uses that same height reference or justify feeding HKPD heights directly to Cesium as ellipsoidal heights. The existing experimental city-height alignment still needs its own validation.

### Useful product surface

A contextual **Paths** layer could answer: “Where is the footbridge?”, “Is there a mapped lift nearby?”, or “Which connections are recorded as covered?” Start with one requested category in the current neighbourhood. A tap can reveal name, connection type, source height/floor and provenance. Keep the full multi-level graph out of the default map: it is visually dense and can look like permission to walk through paid or inaccessible areas.

The plot in `output/playwright/network-probe/network-opportunities.png` compares plan and height-separated views of this actual Admiralty sample. Heights are exaggerated for clarity, and all representations remain source records rather than field-verified access.

## 2. Customization is possible through the existing solver

The route service advertises five modes. Our application currently allows three. More importantly, a JSON travel-mode object was accepted in the live experiment.

| Request                      | Source distance | Source minutes | Observation                                                               |
| ---------------------------- | --------------: | -------------: | ------------------------------------------------------------------------- |
| Shortest                     |       1,164.4 m |           19.4 | Baseline                                                                  |
| Recommended                  |       1,376.8 m |           22.9 | Different geometry; includes soft avoidance warnings                      |
| Barrier-free                 |       1,820.6 m |           30.3 | Different geometry; does not verify current lift operation                |
| Unpaid-area preference       |       1,164.4 m |           19.4 | Same geometry as shortest for this pair                                   |
| JSON shortest control        |       1,164.4 m |           19.4 | Same geometry hash as numeric Shortest mode                               |
| JSON prefer-cover experiment |       1,340.4 m |           22.3 | Different geometry with `Avoid Outdoor (high)` and `Prefer Indoor (high)` |
| Shortest plus point barrier  |       1,168.9 m |           19.5 | Barrier located successfully (`Status=0`); route geometry changed         |

The cover experiment is an **API capability demonstration**, not proof of a higher covered percentage. We have not matched the whole returned route to the published edge attributes, so there is no measured exposure improvement. The solver explicitly warned that outdoor elements were still traversed. Recommended already includes outdoor avoidance and indoor preference, alongside stairs/lift/escalator preferences; another “rain mode” should offer an understandable tradeoff rather than duplicate Recommended under a new name.

A negative control using an invented restriction returned a route while reporting that the restriction was ignored. **HTTP 200 does not mean every requested constraint was honored.** Our current adapter drops the service's `messages`; preserving those messages is a prerequisite for trustworthy customization.

The returned time/distance ratios in these cases are consistent with 60 m/min. These are source estimates, not measured walking times or evidence that lift waiting time and crowds are modeled.

### Useful product surface

- **Prefer cover**, inside route preferences, with a concise explanation and source warnings. Compare time/distance and validate actual coverage before claiming “less exposed”.
- **Avoid this passage/location**, as a deliberate map action. The one-point barrier experiment changed the route without a local graph. This needs checks for snapping to the intended level, failure behavior and preservation of the user's other preferences; it is not an automatic closure feed.
- **Prefer unpaid areas**, as an optional preference. It is a soft preference, so do not label it “guaranteed no fare gates”. The tested route pair did not benefit, so this needs a station-focused case before product promotion.

These capabilities are not exposed by the current application's request schema. Implement them using backend-owned, allowlisted templates and bounded barrier inputs; do not pass arbitrary travel-mode JSON or upstream URLs through the API.

## 3. Better directions can start with data we already receive

The raw directions contain `maneuverType`, `compressedGeometry` and structured strings for individual instructions. Our `normalizeWalkingRoute` currently keeps only text, distance and time. For the Recommended sample, the source supplied left/right/straight manoeuvres as well as seven blank manoeuvre values, so text/transition fallbacks remain necessary.

That supports clearer turn symbols and, after decoding is verified, highlighting the route section associated with the current card. It also creates a basis for combining redundant straight-ahead presentation while retaining the untouched source sequence, floor changes, entrances and connectors in full details.

**Correction to earlier implementation notes:** the normalized app model has no per-step coordinates, but this does not mean the raw service has no per-step spatial information. Compressed per-instruction geometry is present.

A compatibility check used the official `@esri/arcgis-rest-routing` 4.11.0 `decompressGeometry` helper against all 69 Recommended directions. **0/69 decoded into entirely finite coordinates.** This helper expects a different compression representation; its output must not become map markers. A compatible XYZM decoder and alignment tests remain a specific prerequisite, not a reason to rebuild routing.

Changing only direction style was not an effective simplification:

| Direction style     | Source instructions | Route geometry |
| ------------------- | ------------------: | -------------- |
| NA Campus (current) |                  69 | Baseline       |
| NA Navigation       |                  73 | Identical      |
| NA Desktop          |                  68 | Identical      |

A better user experience needs a considered presentation of the instructions, not a renamed style or indiscriminate removal of steps.

## 4. Published access hours are usable, but partial and dated

Eight sampled `AccessTimeID` references successfully joined to access headers and day/time rows. Examples include Saigon Street Playground with `ED, 700–2300` and Kowloon Park with `ED, 500–2359`. `ED` is the source's everyday code. These headers have amendment dates in 2022; they are published schedules, not live access reports.

A concise **“This passage has published access hours”** advisory is plausible once the selected route is reliably matched to these edges. Midnight, public-holiday rules, OPEN versus CLOSE records, absent rows and old schedules need explicit handling. Missing hours mean unknown, not 24-hour access. The route metadata has `useStartTime=false`; this experiment did not establish time-dependent opening-hour enforcement by the solver.

Twelve actual sampled floor IDs were requested from the relation table. Nine returned rows: six lacked a usable polygon reference, while three indoor references supplied named levels and `FloorPolyID` values. Three IDs had no returned row. Returned polygon identifiers use a different identifier scheme from our current WFS floor UUIDs, so a validated bridge is still needed. This can help describe levels, but it is not yet a drop-in replacement for floor matching or indoor positioning.

## Recommended implementation order

| Priority | Work                                                                                                         | User benefit                                             | Relative effort | Own routing graph?                                          |
| -------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| 1        | Preserve manoeuvre types, warnings and source snapping information; prototype a compatible direction decoder | Clearer instructions and honest route limitations        | Small to medium | No                                                          |
| 2        | A requested nearby-connections layer, initially footbridges/lifts/covered links                              | Understand the neighbourhood without reading a long list | Medium          | No                                                          |
| 3        | Carefully tested prefer-cover and avoid-location options                                                     | Personal control over a journey                          | Medium          | No                                                          |
| 4        | Match source edges to routes for exposure summaries and published-hours advisories                           | Explain practical tradeoffs before walking               | Medium to high  | No full solver required                                     |
| Later    | Truly custom effort costs, 5/10-minute network catchments or offline routing                                 | Broader analysis and specialized routing                 | High            | Likely, unless another suitable source service is validated |

A full graph engine becomes worthwhile when a specific validated need cannot be expressed through the source solver: for example, minimizing a verified climbing cost, network catchments or offline operation. The engineering work includes topology at level-separated crossings, direction restrictions, indoor/outdoor joins, duplicate representations, source versioning, endpoint snapping, cost validation and route-quality evaluation. Raw 3D lines alone do not solve those problems.

For the current minimal interface, keep three top-level modes. Put preferences in the planner, network categories in map layers, and source explanations in contextual details. More usable evidence should not mean more persistent text or a permanently visible graph.

## Reproduction and checks

From the project root:

```sh
# Capture missing responses; existing captures are reused to avoid repeated upstream work.
python3 scripts/probe-pedestrian-network.py --live

# Replay captured samples offline, including the seven experimental control checks.
python3 scripts/probe-pedestrian-network.py

# Generate the static research plot without changing app dependencies.
uv run --with matplotlib==3.10.7 python scripts/plot-pedestrian-network.py

# Optional decoder compatibility check, using a pinned official package without installing it into the app.
npm pack --ignore-scripts --pack-destination output/playwright/network-probe @esri/arcgis-rest-routing@4.11.0
node scripts/check-route-direction-decoder.mjs
```

Use `--output <new-directory>` for a new capture set; never interpret cached samples as a fresh live query. Capture timestamps and network build time remain separate from per-feature amendment dates. Initial metadata envelopes without an explicit capture timestamp use the capture-file modification time as a recording-time approximation. No processing rewrites source dates.

Offline replay passed seven controls: Z-bearing schemas, untruncated core boxes, JSON/numeric shortest equivalence, changed geometry for cover preference, ignored-restriction warning, located barrier with changed route, and geometry preserved across direction styles. Python compilation, JavaScript syntax, repository lint and whitespace checks passed. The plot was generated and visually inspected. No production application behavior was changed by this experiment.

## Official references

- [3D Pedestrian Network](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1637222018065_52265)
- [3D Indoor Network](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1742809197336_78665)
- [Government route-search API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search)
- [ArcGIS route request parameters](https://developers.arcgis.com/rest/services-reference/enterprise/route-sync-services/)
- [ArcGIS direction feature fields](https://developers.arcgis.com/javascript/latest/api-reference/esri-rest-support-DirectionsFeature.html)
- [Official REST JS decompression helper reference](https://esri.github.io/arcgis-rest-js/api/routing/decompressGeometry/)

The ArcGIS platform documentation describes general capabilities; only the successful captured requests above establish what worked on this government endpoint in this experiment.
