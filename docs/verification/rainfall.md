# Rainfall visualization — 13 September 2026

## Delivered

- `GET /api/v1/weather/rainfall/manifest`: a feed envelope containing a complete compact publication, SHA-256 revision, bounds and four numeric frames. Gzip is negotiated through Hono's compression middleware.
- Source: [HKO gridded rainfall CSV](https://data.weather.gov.hk/weatherAPI/hko_data/F3/Gridded_rainfall_nowcast.csv), [dataset](https://data.gov.hk/en-data/dataset/hk-hko-rss-gridded-rainfall-nowcast-in-hong-kong), [data dictionary](https://data.weather.gov.hk/weatherAPI/hko_data/F3/HKO_gridded_rainfall_nowcast_documentation.pdf).
- HKT source timestamps are normalized to UTC. Each ending time describes the preceding 30-minute accumulation, in millimetres. These are provisional forecasts, not radar observations or warning levels.
- Complete 121 × 121 grids are validated before publication. Mixed issues, impossible dates, duplicates, incomplete grids, unexpected coordinates/periods and invalid amounts are rejected. Blank amounts remain null; zero remains zero. No undocumented negative sentinel is treated as dry weather.
- Source precision is retained, including unusually high positive totals; no undocumented upper bound clips the source. The top colour bin is 20+ mm per half-hour.
- Same-issue corrections receive a new content revision. Older updates are rejected by the existing feed cache. Failures retain the last-good publication only within its validity window; source-clock errors are rejected before replacing it.
- Singleflight source loading, a 12-minute fetch cache and at least a one-minute failure cooldown. The source body is bounded to 4 MiB with a 45-second timeout.
- Weather-only frontend polling, half-hour slider and 1.5-second playback. Leaving Weather or hiding the page pauses playback. Browser-side age checks hide expired forecasts even when disconnected.
- Cesium uses a north-up raster with cell-edge bounds derived from source centres. Source coordinates are rounded to 0.001 degrees; uniform raster placement approximates that rounding. Smooth display interpolates numeric amounts onto a 4× raster before applying a continuous teal/blue/coral colour ramp and soft opacity near zero. Source grid mode retains the original cells with nearest-neighbour filtering. Neither mode changes the underlying numeric publication. Missing samples are not filled by interpolation. At most three imagery layers are retained and all are destroyed when leaving the weather layer or disposing the scene.

## Measurements and tests

The live sample issued at 16:12 HKT on 13 September contained 58,564 rows, four forecast periods and 121 latitudes × 121 longitudes. Original CSV: 2,697,421 bytes. Prepared JSON sample: 203,594 bytes, 47,419 bytes with gzip. One local Node 24 parse/validation/hash run took about 152 ms; this is not a Workers CPU or peak-memory benchmark.

The live local API returned a valid fresh forecast in about 26 seconds on its first measured request. Initial upstream latency varies significantly; the app labels preparation and failure states rather than substituting a synthetic forecast.

Automated coverage includes geographic orientation, units and times, missing/zero distinction, revision changes, malformed grids, response bounds, concurrent API requests, last-good retention, expiry, fixture isolation and browser freshness logic. Synthetic grids in `fixtures/providers/synthetic-rainfall.ts` are unit-test inputs only and are never served as live data.

## Remaining production work

This first local implementation returns all four compact frames atomically in one response instead of separate immutable R2 assets. This avoids cross-revision mixtures and is small enough for the current slice, but does not implement persistent history, conditional revision downloads or a scheduled collector. Process restart loses the cache. Multi-isolate coordination, Workers CPU/memory feasibility and physical Android performance remain unverified.

Official warning feeds, past rainfall history and point-value inspection are separate work. The LandsD 3D streaming key is still pending; this layer works with the current public raster basemaps.

Browser checks used the production preview at 1280 × 800 and 390 × 844: real forecast raster visible, manual period selection, play/pause controls and expanded phone panel verified. Phone layout had 390 px content width with no horizontal overflow; this is browser emulation, not a physical Android benchmark. A warmed compressed API response measured 45,756 transfer bytes and about 12 ms (a later source revision, so not the same payload as the conversion sample).

One preliminary production reload produced a minified renderer error and a blank map. It did not recur in the final production reload and playback checks; its cause is unconfirmed. Render failures now produce an explicit reload message and a readable diagnostic instead of silently leaving a frozen map. Further device testing should include cold starts and repeated layer changes.

## Rainfall appearance refinement

Smooth is now the default, with Source grid available for direct comparison. The legend switches between continuous colour anchors and discrete source-cell bins. The interface identifies smoothing as a display treatment, not higher forecast resolution. Each smooth texture is 484 × 484 pixels and is generated only when entering the bounded frame cache; there is no animated blur or per-frame spatial calculation. A local Node run prepared three synthetic smooth frames in approximately 60 ms; this is not an Android benchmark. Three additional tests cover interpolation orientation, missing-data boundaries and transparent dry regions.
