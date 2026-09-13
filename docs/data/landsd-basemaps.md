# Public LandsD basemaps

Implemented 13 September 2026. These are raster layers on an ellipsoid, not building meshes or elevation data.

## Sources and access

- [Topographic Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI): key-free XYZ, zoom 10–20.
- [Imagery Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/ImageryMapAPI): key-free WGS84 XYZ, zoom 0–20; this app uses 10–20 within its Hong Kong study extent.
- [Map Label API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/MapLabelAPI): separate transparent English or Traditional Chinese labels.
- [Official integration sample](https://api.hkmapservice.gov.hk/mapapi/sandbox/demos/osm84olbasemap-en.html): confirms the standard XYZ projection and attribution logo URL.

The unchanged official [logo](https://api.hkmapservice.gov.hk/mapapi/landsdlogo.jpg) is copied to `apps/web/public/landsd-logo.jpg` for reliable attribution. Map and aerial source notices are included through Cesium credits. The aerial layer also credits the overlaid map labels.

## Implementation

`scene/basemaps.ts` owns fixed allowlisted provider definitions. WGS84 XYZ uses the Web Mercator tile scheme; HK80 is not interchangeable. Requests are limited to zoom 10–20 and the study rectangle 113.83–114.45 E, 22.10–22.58 N. This rectangle bounds application requests; it is not a legal boundary or a promise of data at every pixel. A neutral global base prevents Cesium stretching regional edge tiles outside coverage.

Map/Aerial/OSM and label-language controls store small local preferences. Switching replaces only changed imagery layers and unsubscribes their error listeners; label-language changes retain the background resources, preserving the Cesium widget, camera, place selection and optional city tiles. OSM remains a manual alternative; failures do not silently change sources. `VITE_MAP_BASEMAP=none` suppresses every external imagery provider for tests.

No tile proxy, bulk downloader, background prefetcher or tile archive is added. The existing Cesium request scheduler manages viewport-driven fetching. Physical Android performance remains unmeasured.

## Separate 3D access

The [public 3D streaming documentation](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api) directs developers to `3dmap@landsd.gov.hk` for free keys. It is distinct from the Government Bureaux/Departments portal. Our project-specific approval remains pending; no sample key is used. Public raster integration does not depend on this request.

## Verification

Real browser checks: LandsD Map and Aerial render, Traditional Chinese labels render, credits remain visible at 390×844, and there is no horizontal overflow or console error during the switching journey. A previous direct request for WGS84 tile 12/3346/1787 returned HTTP 200 and a valid PNG without credentials. The originally supplied 12/3257/1785 returned 204 rather than an authentication error.

Final `pnpm check` passed: TypeScript, ESLint, all 45 existing tests and production build. Formatting checks also passed. The production browser retained the selected place and a single scene canvas across map-style changes; Aerial and Chinese-label preferences survived reload. Build output: interface JavaScript 166.47 kB gzip, separate scene 1,054.31 kB gzip. Existing large-chunk and Zod annotation warnings remain. These figures are transfer sizes, not phone frame-rate measurements.
