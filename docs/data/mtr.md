# MTR Next Train coverage

Verified 13 September 2026 against the [official Next Train dictionary v1.7](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf), [MTR station CSV](https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv) and [dataset description](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data).

## Catalogue

`packages/contracts/src/mtr-network.json` records 98 distinct station codes and 121 valid line/station combinations across ISL, TWL, KTL, TKL, EAL, TML, SIL, TCL, AEL and DRL. Names in English and Traditional Chinese come from the official station CSV. Racecourse is absent from the downloaded station CSV but is explicitly listed as EAL/RAC in the Next Train dictionary; its bilingual label is included separately. UI line colours are display choices.

The dictionary governs API eligibility, rather than assuming every station in the general routes CSV has Next Train coverage. The picker and server validation use the same catalogue. Interchanges retain the chosen station when changing to another line serving it; otherwise the picker selects the first documented station on that line. The selected pair is saved in `line` and `station` URL parameters, and invalid pairs are discarded together. The chosen station uses a 30-second query and process-local cache. Enabling mini trains also polls the selected line (at most 27 stations) with shared station query keys; this extra polling stops when disabled or outside the MTR motion view.

## Train semantics

Names for destinations are resolved using the full shared catalogue, including East Rail branch destinations and special terminating services. East Rail arrival/departure indicators are preserved when provided, and route `RAC` is displayed as Via Racecourse. When the provider omits the indicator, the UI says Estimated train time. Platform and sequence fields accept the documented number representation and the string representation observed in live responses. Error and expired-source responses do not become empty successful schedules.

Light Rail and High Speed Rail are not included in this endpoint. A station in the eligibility catalogue is not a promise of currently operating service; Racecourse and other special services can have no usable data. Fixture mode still covers only ISL/ADM and explicitly reports missing fixtures for other selections.

## Map and verification boundary

Station reference points come from the [Lands Department Location Search API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI), prepared into `packages/contracts/src/mtr-locations.json`. The catalogue retains original names and HK1980 easting/northing plus its retrieval date. Exact English `MTR <station name> Station` matches are required; ambiguous or missing matches stop publication. Entrance/access records are not substituted.

Coordinates are converted from EPSG:2326 to EPSG:4326 using pyproj 3.7.2. A Sha Tin reference point was independently checked against the [official coordinate transformation API](https://www.geodetic.gov.hk/transform/v2/?inSys=hkgrid&outSys=wgsgeog&e=837302&n=826990), agreeing to the six decimal places stored in the catalogue. Points describe station locations, not specific entrances, platforms, indoor layouts or survey-grade navigation.

The map displays only the active line's stations, with a larger selected point and one label. Tapping a point keeps the active line, updates the shared URL/picker and fetches that station's train times. Switching lines at an interchange retains the station. Points are batched and reused when selecting another station on the same line; switching to weather, Explore or cameras hides them. No connecting geometry is drawn because station order does not establish the actual railway alignment.

To refresh the catalogue, use `scripts/prepare-mtr-locations.py <cache-directory>` in a Python environment with `pyproj==3.7.2` and curl. Use a new cache directory for a fresh source snapshot. Requests are sequential, spaced and cached; unresolved matches require review rather than fuzzy assignment. Run the project checks after reviewing the resulting diff. This preparation step does not run in users' browsers or on every server start.

Live checks returned fresh data for EAL/SHT and DRL/SUN, including readable Lo Wu and Disneyland Resort destinations. Browser checks verified the Sha Tin URL and switching Admiralty between Island and East Rail lines. This is not a live availability test of every line/station pair.

Automated tests validate every catalogue pair, bilingual name coverage, rejection of cross-line pairs, URL handling and East Rail time/route semantics. The existing freshness, failure and fixture tests continue to apply.

Station-map verification on 13 September 2026: all 98 station codes matched exactly by English name. Chinese source names also agree, apart from the 荔/茘 character variants for Lai Chi Kok and Lai King; source spellings are preserved. Browser checks covered Sha Tin focus, clicking Fo Tan, and retaining Admiralty when switching from EAL to ISL at a 390 × 844 viewport. These are responsive browser checks, not a physical Android performance measurement. The project check passes 78 tests, type checking, linting and build; the existing large Cesium chunk warning remains.

## Mini trains on all ten lines

Mini trains cover the ten lines in the station picker: ISL, TWL, KTL, TKL, EAL, TML, SIL, TCL, AEL and DRL. Only the selected line is drawn and polled. Each station shares the existing detail-panel query key and backend cache, with 30-second refreshes and background interval polling disabled. The largest line has 27 station queries, not a network-wide polling fan-out.

Each icon is an arrival/departure timing illustration, not a GPS position, stable train identity or unique fleet count. Fresh station estimates use a disclosed 40 km/h visual assumption plus 20 seconds per segment. Approaches stop for eight seconds at the estimated arrival and fade in the last second. At originating terminals, including the two-station Disneyland shuttle, an icon appears stationary eight seconds before the listed time and then illustrates departure along the first segment. A retained past estimate can finish its short illustration after a refresh, but the new feed must remain fresh and free of delay reports. ETA revisions may reposition illustrations.

Branch connectivity comes from separate OSM route members, never the flat picker order. The LOHAS Park spur and East Rail Lo Wu, Lok Ma Chau and Racecourse paths are included. The Racecourse remark selects the bypass. Where the incoming branch is ambiguous (for example southbound Sheung Shui or westbound Tseung Kwan O), the illustration is hidden instead of guessing. Missing/invalid destinations, stale (90 seconds), fixture, unavailable and delayed feeds also hide illustrations. Terminal-destination reports without a usable direction of travel are omitted. Clicking a sprite selects its source station and line.

### Geometry and reproduction

The [OSM MTR route catalogue](https://wiki.openstreetmap.org/wiki/MTR) was used to discover relation IDs; current full relation responses were downloaded and validated on 13 September 2026. The dated wiki descriptions are not treated as current route coverage. Current geometry includes the East Rail Admiralty extension and full Tuen Ma route.

The source relations are listed beside every route in `apps/web/src/features/trains/railway-tracks.json` and in `scripts/prepare-mtr-tracks.py`. Download each `https://www.openstreetmap.org/api/0.6/relation/{id}/full.json` to `output/mtr-motion/{id}.json`; the existing Island Line source uses `island-line.json`. Run `python3 scripts/prepare-mtr-tracks.py`, then format the generated JSON. The script rejects disconnected ways, off-track stops and unordered stops. Exact English names resolve missing references; OSM SWT is explicitly mapped to MTR SUW. No remote geometry requests run during browsing.

The derived database is licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright). OSM attribution remains visible while railway geometry is shown. Both travel directions share one alignment per branch; these are not lane-accurate or tunnel-depth models. Lands Department station-centre dots can differ from the OSM platform positions. Source geometry is community-maintained rather than surveyed operational telemetry.

### Rendering and validation

The scene reuses a pool of 54 sprites, colours the train stripes and track using the selected line colour, and scales sprites down when zoomed out. Animation updates stay outside React: Eco requests 5 Hz, standard approximately 15 Hz and high approximately 30 Hz. These are update caps, not measured frame rates. Hidden tabs and reduced-motion settings stop animation. Leaving the mode removes visible trains and stops the extra polling; line changes replace geometry and discard retained estimates from the previous line.

All 103 tests, type checking, linting and production build pass. Tests cover all ten lines and every catalogue station, branch routing and ambiguity, originating shuttles, exact dwell boundaries, stale isolation and interpolation bounds. Existing Cesium bundle and Zod annotation warnings remain. Physical Android performance and live availability at every station are not established by these tests.

Browser verification on 13 September 2026 showed red train sprites on the Tsuen Wan alignment, then blue sprites at Sha Tin after switching to East Rail. The previous line geometry was cleared. This verifies representative live rendering and switching, not live service availability across all ten lines.
