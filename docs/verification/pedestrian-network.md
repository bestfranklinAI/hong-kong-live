# Pedestrian network integration verification

19 October 2026. See the [architecture and interface boundaries](../architecture/pedestrian-network.md).

## Automated evidence

Typecheck, lint, 340 tests across 85 files and the production build passed. Existing nonfatal StationFloorPlan hook-dependency, React test act, dependency annotation and bundle-size warnings remain.

Tests exercise fixed upstream destinations, route/schema bounds, rejection of arbitrary query options, fixture isolation, coded false values, XYZ preservation, independent source/fetch dates, pagination/truncation, shared category caching, overlapping route windows, disjoint path separation, deduplication, request cancellation, route replacement, unknown-height gaps, source manoeuvre fallback, retained source advisories and preservation of wheelchair restrictions when adding cover preferences.

## Live source checks

The running app API returned 109 connection records without truncation for the recorded Central Waterfront–Hong Kong Park Recommended route. This verifies the adapter and HTTP path against the public source; it does not establish that these records are traversed by the route. Initial large/filtered queries returned HTTP 403. Accepted spatial queries use smaller overlapping route windows and filter records locally. Direct adapter and app API checks both succeeded after restarting the API to load the workspace provider changes.

Artifacts are under ignored `output/playwright/network-probe/`: `integration-network-direct.json`, `integration-network-live.json` and the original experiment packets. Captured data retains its fetch/source dates; it is not silently substituted for live runtime results.

## Jev

The expanded twelve-case live evaluation reached `jev-1.13.0`. Initially 9/12 passed: Cantonese soft cover was treated as a continuous-shelter requirement, negated stair avoidance was interpreted positively, and the earlier lift-status case abstained. The prompts now distinguish positive mobility requests, equipment status, soft cover and continuous shelter, with explicit Cantonese negation examples. No confidence threshold or expected answer was relaxed. The next run passed 12/12, with 22 successful API calls. These are small reference-case results, not measured general calibration or broad production accuracy.

Reports are under ignored `output/evaluation/jev-network-preferences-initial.json` and `jev-network-preferences-final.json`. The expanded reference suite includes English/Cantonese soft cover and negated cover, and still treats continuous shelter and working lifts as unverified needs. Default operator gating and explicit user submission remain.

## Browser checks

A real-browser check exercised the live government route request, the optional Connections/Shelter layer, the height diagram and the selected-route reference. The cover-modified Shortest request returned approximately 1,340 m / 22 minutes for the public Central–Hong Kong Park endpoints; Recommended with cover returned approximately 1,377 m / 23 minutes. The source soft-preference advisory stayed visible.

A separate live browser request, “Find a park near Admiralty, preferably covered, with fewer stairs”, produced a source-backed Tamar Park suggestion. Selecting it set Recommended and cover preferences without calculating a route. DOM checks confirmed both preferences and the absence of a route preview before explicit submission.

Visual checks at 360×640, 390×844 and 1280×900 found no document horizontal overflow. The plan includes a green route reference, while the height diagram omits that reference to avoid mixing unverified vertical datums. Connections and shelter remain visually subordinate to the route on the main map. Source names are used where present; technical IDs are inside source details. No application errors appeared after a fresh load of the final UI.

Screenshots: `output/playwright/network-small-mobile-plan.png`, `network-small-mobile-height.png`, `network-mobile-height.png`, `network-mobile-shelter.png` and `network-desktop.png`. Browser snapshots/logs are development artifacts, not physical phone evidence.

Physical Android GPU behaviour, GPS quality, floor alignment and real-world passage/accessibility conditions require separate evidence.

## Clarity revision

The route advisory now names known traversed restrictions in plain language, explains soft preferences and avoids claiming a required fee from paid-area classification. Unknown restriction names retain a general advisory and the original message. Ignored options keep priority.

The network controls now use Show nearby walkways, Bridges & lifts and Rain cover. A single type filter has one option for each source type; it updates the shared data used by both maps without a new fetch. Source Subway is labelled Pedestrian underpass. The repeated segment dropdown is removed. Tapping a line opens its recorded type and cover, with technical information behind Source details. A bridge or escalator can contain several source sections, so no facility counts or merges are asserted. Keyboard users have one diagram tab stop and arrow-key section navigation; transparent hit strokes enlarge pointer targets.

Regression tests cover restriction translation/unknown fallback, paid-area interpretation, one filter option per type, pointer/keyboard selection, hidden technical details, shared map filtering without refetching, and existing request cancellation.

Clarity checks: typecheck, lint, 345 tests across 88 files and the production build passed (existing warnings remain). A real-browser click exposed a nearly vertical lift edge that was too small to tap; lift sections now have visible point targets in the overview and ground-projected markers on the main map. The marker test checks that source heights are not treated as ellipsoidal heights and that hiding/disposal clears resources. Phone layouts at 390×844 and 360×640 and desktop at 1280×900 were checked, including actual diagram selection. Screenshots are `network-clarity-lifts-mobile.png`, `network-clarity-small-mobile.png` and `network-clarity-desktop.png` under ignored `output/playwright/`.
