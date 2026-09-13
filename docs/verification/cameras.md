# Traffic camera slice — 13 September 2026

## Source and delivered behavior

The [Transport Department traffic snapshots dataset](https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images) supplies a location catalogue and JPEG stills. The [official English catalogue](https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.csv) returned 1,013 records in the sample checked today. Despite its extension, the sample is UTF-16LE with tab separators and repeated BOMs. The adapter handles that encoding explicitly and accepts UTF-8 with the same schema.

Transport now offers MTR departures and Traffic cameras. Camera locations render as one batched primitive collection; selection highlights a location and opens one image card. The list supports road/ID search and district filtering, showing at most 40 matches while all catalogue locations remain on the map. Selected locations use the catalogue's latitude/longitude directly.

`GET /api/v1/cameras` returns a validated bounded catalogue with source and fetch metadata. Loading is singleflight, cached per API process for one hour, retained for at most 24 hours, and limited to 1 MiB / 2,000 records with a 15-second fetch timeout. Failures have a one-minute retry cooldown. Fixture mode does not contact the provider and explicitly reports the missing camera fixture. The catalogue supplies no source-update timestamp; its generic feed status is therefore stale/unknown, never proof of current camera availability.

Images load directly from the government host into an ordinary image element; there is no image proxy, canvas extraction, history or archive. Only the selected visible card refreshes, normally every two minutes; background-page polling is suppressed. Leaving the camera panel unmounts the image and clears its timer. Image failure or a 20-second wait produces a retry/original-source option. A successful JPEG can itself be a provider “No Service” placeholder, so the UI does not claim the camera is operational merely because the image loaded.

Image load time is labelled separately from capture time. Capture time is not supplied in the catalogue or independently parsed from the JPEG; users can inspect any timestamp printed into the source image.

## Source anomalies

The sample maps catalogue IDs AID09104 and AID09206 to each other's image filenames. The implementation preserves the explicit official URLs instead of synthesizing URLs from IDs. Every accepted URL is constrained to HTTPS on `tdcctv.data.one.gov.hk` with a simple JPG filename. No arbitrary remote URLs or query fragments are accepted from catalogue rows.

## Verification and limits

- The full downloaded catalogue parsed successfully: 1,013 locations.
- Live local API request completed in approximately 4.8 seconds.
- Production browser loaded H106F (Connaught Road Central near Exchange Square): natural image dimensions 320 × 240; map and preview visually inspected, with no browser errors in that check.
- Adapter tests cover encoding, duplicate IDs, coordinate validation, source URL restrictions and body limits. API tests verify outage envelopes, singleflight and fixture isolation.
- This is an English catalogue slice. Traditional Chinese catalogue merging, shareable camera selections, saved camera collections, viewport-bounded catalogue delivery and physical Android measurements remain future work. No claim is made that all 1,013 image endpoints are currently operational.

Final responsive check: at 390 × 844 the selected marker remained in the map area above the expanded panel, the real image loaded, and document width equalled viewport width (390 px). Exactly one camera image element was present for the selected preview and zero after switching to MTR. No browser errors were reported during these checks. Camera list selection was browser-tested; direct canvas-marker picking has not yet received a separate automated interaction check. All 69 tests, typecheck, lint, production build and formatting checks passed. Existing large Cesium chunk and Zod annotation build warnings remain.
