# Admiralty route consistency and floor-candidate audit — 26 September 2026

Scope: live source consistency and an offline geometry experiment. No personal location or field observation was used. Current lift operation, access hours, ticket barriers and physical passability are not verified.

## Live route checks

The official catalogue returned 159 eligible routing points across 12 named levels, and 13 floor outlines. Exit D Ground Level has an outline but no eligible endpoint points in this response. The picker correctly lists levels with actual mapped points rather than inventing an endpoint at a polygon centre.

| Journey | Profile | Distance | Source time | Transition instructions | Endpoint XY offsets |
| --- | --- | ---: | ---: | --- | --- |
| East Rail Platform 7 → South Island Platform 5 | Barrier-free | 69.5 m | 1.16 min | 1 lift | 0 m / 0 m |
| East Rail Platform 7 → Ground Exit E1 | Barrier-free | 158.6 m | 2.64 min | 2 lifts | 0 m / 0 m |
| Ground Exit E1 → East Rail Platform 7 | Barrier-free | 158.6 m | 2.64 min | 2 lifts | 0 m / 0 m |
| East Rail Platform 7 → South Island Platform 5 | Recommended | 69.5 m | 1.16 min | 1 escalator | 0 m / 0 m |

The application re-resolved source point IDs before solving. Returned endpoint source heights matched: East Rail −28.03, South Island −33.63, Ground Exit E1 6.0. Equal reported distances/times do not imply identical routes: the recommended interchange route uses an escalator while the barrier-free route uses a lift. These are source estimates, not observed travel times or accessibility guarantees.

## Candidate floor experiment

For each returned vertex, test its XY against each official floor polygon, respecting inner rings. Then retain candidates whose source floor Z differs by no more than **0.25 source units**. This is an experimental tolerance, not a surveyed accuracy statement or verified floor ID. The diagnostic checks polygon boundaries with small numerical tolerances (1e-10 coordinate bounds / 1e-14 cross product), and does not simplify geometry.

| Journey | Vertices | Ambiguous using XY only | Unique using XY + source Z | Segments with unresolved interior samples |
| --- | ---: | ---: | ---: | ---: |
| East Rail → South Island, barrier-free | 24 | 15 | 24 | 1 of 23 |
| East Rail → Ground E1, barrier-free | 46 | 37 | 46 | 5 of 45 |
| Ground E1 → East Rail, barrier-free | 46 | 37 | 46 | 5 of 45 |
| East Rail → South Island, recommended | 21 | 14 | 21 | 1 of 20 |

Interior checks sample 25%, 50% and 75% of each straight geometry segment, interpolating its source Z. All three samples must have exactly one identical candidate to count as a same-candidate segment. This does **not** prove full segment containment; thin gaps between samples can be missed. Unresolved segments must not be silently snapped to their starting or ending floor. A lift or sloped transition can have valid endpoint floors while its interior belongs to neither horizontal floor plane.

These results establish candidate matching feasibility for this sample, not automatic floor switching. Matching is limited to the explicitly selected venue; it cannot be generalized to neighbouring malls, footbridges, overlapping station structures or GPS height without further evidence. The application remains unchanged and continues ground projection.

## Reproduce and inspect

- Run `python3 scripts/audit-admiralty-floors.py` from the repository (no network or dependencies). Its basic polygon/hole assertions run before the calculation.
- [Machine-readable findings](admiralty-routing-2026-09-26.json) contain endpoint IDs, fetch timestamps, profile-specific results and candidate counts.
- `fixtures/providers/admiralty-routing-audit-2026-09-26.json` contains the captured normalized source points, floors and four route responses. It is audit evidence only, never a live fallback.
- Sources: [official indoor station API](https://tools.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map) and [official route API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-pedestrian-route-search).

## Next gates

1. Build an explicitly labelled candidate-floor inspector, leaving ambiguous and transition segments unassigned. Preserve original route directions and IDs; do not claim authoritative floor matching.
2. Validate complete segment containment and route-step geometry mapping, including holes and vertical connections, before linking instruction selection to a floor preview.
3. Field-check the two lifts to Exit E1, ticket barriers, platform access and both travel directions. All physical checks remain outstanding.
4. Verify the source vertical datum before rendering routes at physical heights inside the 3D mesh.
