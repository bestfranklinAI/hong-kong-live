# Admiralty visual height trial — 27 September 2026

## Finding

**Raw source Z is the better local rendering hypothesis among the tested candidates. No production conversion is established.** Two candidate exposed-surface points near Exit E1 differ from the live city mesh by approximately −0.19 m and +0.20 m. Applying the HKPD hypothesis worsens their agreement by about 2.6 m. This could mean the routing output already agrees with the model's effective height reference, or reflect source/model conventions; this experiment does not identify the formal datum.

## Experiment

An isolated Vite page at `/admiralty-height.html` renders the captured East Rail platform → Exit E1 route from `fixtures/providers/admiralty-routing-audit-2026-09-26.json`, preserving source Z. It uses the configured authorised live tileset. The fixture date and experimental status are visible. It is not an application route, live route fallback or navigation feature.

Compared raw Z, Z − 2.618 m and Z + 5 m, using the same Exit E1 camera. A manual offset control allows further inspection without changing normal navigation. The mesh can be hidden to inspect underground geometry. Pink lines deliberately show occluded geometry; visibility through a roof must not be mistaken for a route lying on that roof. Markers have depth testing disabled to remain visible and likewise do not prove surface alignment.

Measured the most-detailed available mesh height with Cesium `sampleHeightMostDetailed`, excluding the experiment's entities, at 12 source points on ground/deck levels. **The first/upper surface is not necessarily the walkable surface.** Large residuals at covered entrances are not calibration targets. The mesh is photogrammetric, and no surveyed control or physical visit was performed.

## Numerical observations

Residual below means mesh height minus candidate route height, in metres under each hypothesis.

| Source point | Source Z | Mesh height | Raw residual | Z − 2.618 residual | Z + 5 residual |
|---|---:|---:|---:|---:|---:|
| Exit E1 | 6.000 | 5.812 | −0.188 | +2.430 | −5.188 |
| Nearby ramp, E1/E2 ground | 6.000 | 6.200 | +0.200 | +2.818 | −4.800 |
| Exit E2 — covered/ambiguous | 6.000 | 13.725 | +7.725 | +10.343 | +2.725 |
| C1 — upper surface ambiguous | 6.100 | 22.284 | +16.184 | +18.802 | +11.184 |
| C2 — upper surface ambiguous | 5.700 | 27.025 | +21.325 | +23.943 | +16.325 |

The mean absolute residual of the **two nearby candidate exposed points only** is about 0.194 m for raw Z, 2.624 m for the HKPD hypothesis and 4.994 m for +5 m. They are spatially clustered and selected after seeing the scene; this is exploratory evidence, not held-out validation. A fitted offset would be only +0.006 m, far below justified precision. Do not apply it.

The elevated deck elevator and ground elevator share XY but different source Z. The mesh samples the same upper surface for both, demonstrating why vertically projecting every route point onto the mesh cannot recover indoor levels.

Full measurements and sampling timestamp: [JSON evidence](admiralty-mesh-samples-2026-09-27.json). Initial concourse samples were excluded from the final ground/deck sample set because an exterior upper-surface comparison cannot validate an underground floor.

## Official transformation cross-check

Used the [documented v2 transformation API](https://www.geodetic.gov.hk/transform/tformAPI_manual.pdf), with `inSys=wgsgeog&outSys=hkgrid&h=0`, at public source coordinates:

| Point | Latitude | Longitude | Returned HKPD height |
|---|---:|---:|---:|
| Exit E1 | 22.27890956 | 114.16601088 | 2.618 |
| C2 | 22.27904296 | 114.16478974 | 2.624 |
| Exit A ground escalator | 22.27947052 | 114.16516636 | 2.624 |

Thus, **if** route Z is HKPD, a local candidate is Z − approximately 2.62 m. The inspector uses the E1 value across this small area as an explicit approximation, not a general HKPD converter. The route's vertical datum remains unconfirmed. [API height semantics](https://www.geodetic.gov.hk/transform/doc/DataDictionary.pdf).

## Recommendation

An opt-in 3D inspection view using raw Z, a visible unverified-height label and occluded-path styling is technically feasible. Do not call it validated floor-aligned navigation. Normal navigation stays unchanged. Next, find independent exposed ground and bridge-deck points outside the E1 cluster, preferably surveyed or with authoritative heights, and ask LandsD for the routing output's Z reference. Keep roofs, canopies and underground points out of an automatic offset fit.

## Reproduce

1. Configure the existing public-browser-authorised `VITE_HK_3D_TILESET_URL` (do not commit the key).
2. Run `pnpm --filter @hk/web dev` and open `http://127.0.0.1:5173/admiralty-height.html`.
3. Select **Inspect Exit E1**, wait for visible model tiles to load, then compare the three interpretations without reframing.
4. Select **Sample mesh at entrance points** for machine-readable measurements. Retry only for a failed/incomplete load; differences across later mesh versions are possible.
5. **Hide city** reveals the preserved 3D route shape, but provides no independent indoor-height evidence.

Screenshots are in ignored `output/playwright/admiralty-height-{raw,hkpd,plus5,underground}.jpg`. The experiment is served in development only, excluded from the normal single-page production build. Typecheck, lint, tests and production build are run for the change.
