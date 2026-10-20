# Route context from the government pedestrian network

Implemented 19 October 2026. The government solver still calculates routes. This integration adds optional source context and typed preference handoff; it does not introduce a local routing engine.

## Journey and responsibility

1. Choose mapped endpoints directly, or explicitly submit an experimental Jev discovery request. Jev returns supported interests, mobility and an optional cover preference. It never returns coordinates, route geometry, access facts or a floor position.
2. Select a mapped destination. An interpreted fewer-stairs preference suggests Recommended; explicit barrier-free access suggests Barrier-free. These remain editable before the user requests a route. Cover is visible in the interpreted search and planner summary and editable in Options. Neither choosing a place nor interpreting a request calculates a route automatically.
3. The existing government solver calculates the route. A cover preference adds only the adapter-owned `Avoid Outdoor (high)` and `Prefer Indoor (high)` restrictions to the selected source mode. All existing restrictions, especially wheelchair barriers, remain. Recommended already favours indoor paths; no duplicate rain mode is introduced. Missing supported mode parameters cause an explicit error.
4. Route preview offers **Show nearby walkways**, initially off. **Bridges & lifts** shows footbridges, pedestrian underpasses, lifts, stairs and escalators; **Rain cover** colours nearby paths by recorded cover. These are two views of one bounded source publication. A single type filter (one option per type) updates both the main map and diagram without another source fetch. Closing the layer or replacing the journey clears the overlay and cancels the browser request. It is hidden during active walking and floor-plan inspection.
5. Source manoeuvre fields select direction symbols, with explicit connector text taking precedence and text fallback for absent/unknown manoeuvres. The original instruction sequence and manual floor confirmation remain.

The default Jev operator flag remains off. A configured operator can expose the existing explicit interpretation action. There are no model calls from location updates or network rendering. See [smart-search verification](../verification/smart-search.md).

## Bounded data access

`POST /api/v1/routes/network` accepts only validated WGS84 route paths and a connections/cover category. The request is limited to Hong Kong, 6,000 vertices, 30 km of line length and a roughly 15 km bounding extent, with a 512 KiB HTTP body bound. Other routing bodies retain their 8 KiB bound. Fixture mode rejects live network requests. No client URL, SQL, source layer or travel-mode JSON is accepted.

The provider queries only the fixed general-network layer:

`landsd_rcd_1637222018065_52265/MapServer/0/query`

The published layer supports a 50 m horizontal distance around polyline geometry. Live testing found that its gateway rejects the feature-type `IN` filter and large forms. The adapter uses the accepted `where=1=1` spatial query, overlapping windows of at most 80 route vertices, and local validated domain filtering. It preserves every submitted bend and never joins disjoint route paths. Pagination uses stable OBJECTID order and 400 records per page. Limits are six source requests, three pages per window, 25 seconds overall, eight seconds per request, 4 MiB per response, 1,200 unique records and 60,000 returned vertices. Any unvisited windows or truncated pages set `partial=true`; the UI explicitly reports omitted detail.

One process-local cache holds at most eight publications for six hours. Both categories share cached data and concurrent reads. Two publications can load concurrently. Geographic coordinates are not placed in the preferences store or persisted by this feature. Each edge retains its source amendment date independently from fetch time. Unknown/invalid dates stay unknown. Coded value 2 means false for Enabled, rather than JavaScript truthiness.

This integration queries the general network only, which itself contains some indoor records. The separate indoor network is not concatenated or presented as deduplicated coverage.

## Rendering and evidence boundaries

The renderer owns disposable line and point primitive collections. Vertical lifts retain ground-projected point markers because their XY lines can collapse to a point; these markers do not identify a floor or verify operation. Thin contextual lines use a ground projection below the prominent walking route; they do not alter the route or camera framing. HKPD gravity-related heights are not treated as Cesium ellipsoidal heights.

The plan diagram includes the selected solver route as a horizontal reference; it does not imply that the nearby edges are traversed. Tapping a mapped section shows its type, source name when available and recorded cover. The repeated per-record dropdown has been removed. Keyboard users can focus the diagram once and move among its visible sections with arrow keys. Technical IDs and height/access references remain inside Source details.

A local **Height view** displays the same network XYZ records in a fixed isometric diagram, with vertical separation exaggerated three times. Unknown-height runs are disconnected. The selected section shows its type and cover status, with height, amendment date and floor/access-time references inside Source details. This is a source-network diagram, not indoor positioning or validated alignment with the city mesh.

Nearby lines are not attributed to the route. The integration does not claim covered percentages, fewer stair counts, working lifts, current opening hours, paid-area access, floor matches or a guaranteed step-free/fully sheltered route. Existing floor-plan association remains separate. Per-instruction compressed geometry decoding and authoritative route-to-edge/floor joins are still future work.

Solver messages survive normalization. A compact advisory disclosure remains visible in preview, with named conditions in plain language (for example, “Route includes stairs, outdoor sections, and paid-area links”). Expanding it explains that avoid conditions are preferences, and that paid-area classification does not establish a required fare. The original source message remains inside a nested disclosure, including unknown restrictions, and is available in Journey details. Ignored restrictions are distinguished from unmet soft preferences. HTTP 200 is not interpreted as proof that every preference was honoured.

## Interface rules

Follow [the mobile design system](../design/mobile-experience.md): system UI typography, 16 px editable fields, 13–14 px supporting text, forest primary actions, neutral bordered disclosures, 44 px touch targets and existing spacing tokens. Paths adds no top-level mode. The default route preview stays compact; the network diagram, record inspector and source explanation appear only after opting in.

Geographic context uses purple `#7866a1` for connections, blue `#547bb2` for covered, ochre `#b47a40` for uncovered and grey `#929b96` for unknown records. The route remains green. The diagram includes a labelled shelter legend, a dashed unknown treatment and a text record inspector. Selection uses the primary ink colour and a thicker line. Source limitations belong with the relevant control; longer explanations remain inside disclosures.

Official references: [network dataset](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1637222018065_52265), [ArcGIS spatial queries and pagination](https://developers.arcgis.com/rest/services-reference/enterprise/query-map-service-layer/), and the [recorded experiments](../data/audits/pedestrian-network-experiments-2026-10-19.md).
