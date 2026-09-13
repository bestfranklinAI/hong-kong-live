# First renderer foundation

## What exists

The first vertical slice uses one lazy-loaded Cesium scene, managed by `SceneController`. React sends selection, quality, mode and camera commands. The renderer owns points, labels, imagery and the camera; none of those engine objects enter React state.

The default source is the public OpenStreetMap raster service over an explicitly flat WGS84 ellipsoid. This supplies real street geography with no API key. **It does not supply 3D buildings, photogrammetry or terrain relief.** The interface reports that distinction. No synthetic building geometry is presented as open data.

The scene explicitly disables default ion imagery, sets ellipsoid terrain, disables shadows/sky animation, and uses demand rendering. Quality presets control resolution, imagery screen-space error, MSAA and optional city-tile detail/cache estimates. These settings are starting policies, not measured phone memory budgets.

## Sources and delivery

- Raster tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png` through Cesium's OpenStreetMap provider. Credits remain visible in the scene. [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/), [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).
- Standard browser caching and referrer behaviour must be preserved. Do not add offline downloads, aggressive prefetch, proxy anonymisation or a service worker that bypasses source caching. This public service has no availability guarantee; review a suitable tile host before public-beta traffic grows.
- Automated rendering/interaction tests must use `VITE_MAP_BASEMAP=none` or a dedicated licensed fixture server. Do not use automated camera sweeps to harvest community tiles.
- Set `VITE_HK_3D_TILESET_URL` only to a tileset URL authorised for public browser delivery. Every Vite environment value is public client code. A secret key needs an approved backend delivery design; this variable does not protect it.
- No sample key, token or unknown third-party terrain is included. A connected tileset still needs complete nested manifest/geometry/texture CORS, attribution and mobile performance validation. [LandsD 3D map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api).
- Cesium assets are served from `/cesium`; the Vite build must copy the dependency's `Assets`, `Workers`, `Widgets` and `ThirdParty` directories. [CesiumWidget API](https://cesium.com/learn/cesiumjs/ref-doc/CesiumWidget.html).

## Lifecycle and interaction

The controller destroys its input handler, event subscriptions, collections, optional tileset and widget. A tileset completing after unmount is destroyed instead of being attached to a disposed scene. Reduced-motion preferences remove camera flight duration. Picking uses batched markers and labels; the accessible DOM place list is the alternative to canvas interaction.

For mobile selection, the UI supplies a `frameAbove` overlay selector. The React adapter observes that panel and the map bounds, then passes numeric viewport insets to the controller. Camera translation places the actual selected coordinate in the uncovered viewing area; neither place coordinates nor the projection frustum are altered. The observer disconnects on cleanup. Desktop framing uses the normal centred camera path.

Weather mode hides a connected city mesh and moves to a top-down view. This is a presentation foundation, **not rainfall data rendering**. Actual weather observations are separate semantic data. No forecast grid or moving vehicle position is fabricated.

`window.__HK_SCENE__` is installed only in development. `snapshot()` reports camera, selected ID, source state, tile queues, drawing-buffer dimensions and rendered-frame count. It never exposes the tileset URL or credentials. `command()` supports deterministic camera commands against non-network fixtures. Frame count is not FPS, and tile queues becoming empty do not establish semantic scene completeness.

## Still required before renderer selection

1. Obtain authorised city tiles and compare the same representative HK scene against MapLibre + deck.gl.
2. Record actual Android model, browser, thermal conditions and laptop GPU.
3. Measure cold/warm scene readiness, interaction frame-time distributions, payloads and sustained behaviour.
4. Validate a prepared rainfall frame and one indoor floor, including horizontal and vertical reference systems.
5. Verify failed nested requests, context loss and credits on every responsive layout.

No renderer comparison or physical-Android benchmark is claimed by this implementation.

## Public raster integration — 13 September 2026

The initial OSM-only baseline described above is superseded for the default basemap: public LandsD Map/Aerial layers and English/Traditional Chinese labels are now connected. OSM remains selectable. This changes raster imagery only; the textured 3D benchmark is still open. See [integration details](../data/landsd-basemaps.md).
