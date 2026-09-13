# 0001 — First working slice

Status: implemented foundation; production and physical-device gates remain open.

## Boundaries

The web app uses React/Vite, TanStack Router/Query, Zustand, Base UI primitives and a lazy Cesium scene. Hono runs locally through its Node adapter, with a Workers-compatible fetch entry point. Provider code and runtime schemas are shared packages. No framework-specific render objects leave the scene module.

Source-specific logic stays in providers. The API validates bounded station/line pairs and handles freshness through a request-triggered in-process cache. This is appropriate for the local first slice; it is not a globally shared cache. The planned Durable Object coordination and R2 publication are not silently simulated or considered deployed.

## Renderer decision is still provisional

Without a project-issued LandsD key, we can verify the engine lifecycle, interface and key-free LandsD/OSM raster basemaps. We cannot claim this proves LandsD tile performance or wins the Cesium versus MapLibre/deck comparison. The app exposes an optional authorised tileset setting and keeps the engine adapter narrow so the planned comparison can still change the choice.

The default terrain is an ellipsoid. There are no invented building meshes, invented heights or fake live markers. Weather mode selects a top-down presentation; the future rainfall data layer is a separate implementation.

## State and data

- Router: selected known place and mode; validates external URLs and supports back/forward.
- Preferences: bounded local bookmarks and quality choice.
- Query: bounded remote responses, request cancellation and visible-page refresh.
- Scene: camera, point/label collections, image/tile lifecycle and quality controls.

All live readings carry provider and source/fetch timestamps. API errors never load recorded fixtures in live mode. Browser-cached departure data also expires, even if a later request fails before reaching the API.

## Deliberate first-slice limits

Search is a curated catalogue, not the full address service. MTR covers selected pairs; buses/minibuses, CCTV, rainfall frames and indoor models remain later stages. Bookmarks do not sync across devices. Shareable view state includes selection/mode; arbitrary settled camera URLs remain to be added with the renderer benchmark. Cloud hosting has not been purchased or deployed.
