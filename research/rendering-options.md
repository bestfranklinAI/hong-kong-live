# Rendering architecture for Hong Kong Live

Research date: 13 September 2026. Target: an Android phone, a laptop, and a small public beta. This is a documentation-based recommendation; no renderer benchmark or device test was performed for this note. Official documentation was checked live. The installed Context7 skill was read, but no Context7 tools were callable, so primary web documentation was used instead.

## Recommended decision

**Start with CesiumJS on WebGL2 as the sole map renderer, inside a React application with a thin backend.** Build one neighbourhood and one indoor venue before expanding. Use ordinary HTML/CSS for the polished interface; Cesium need not dictate its appearance. The engine owns cameras, picking, geometry and tile lifecycles. React owns search, selected places, sheets, settings and URLs. Avoid routing per-frame camera or animation values through React state.

This recommendation follows the product's centre of gravity: a georeferenced textured city, terrain and indoor transitions. It is an engineering judgement about integration risk, not evidence that Cesium will be faster than the alternatives. The reported slowness of the existing government viewer has not been diagnosed. Replacing its UI or JavaScript framework cannot by itself reduce the tile payload, GPU texture footprint or upstream latency.

| Candidate | Fit | Decision |
|---|---|---|
| CesiumJS | Integrated geographic camera, 3D Tiles, terrain, picking and clipping; supports custom UI | Default for the first working slice |
| MapLibre GL JS + deck.gl `Tile3DLayer` + loaders.gl | Attractive for cartographic styling, transit and analytical layers; can load textured tile content | One bounded benchmark challenger |
| Three.js + React Three Fiber + `3d-tiles-renderer` | Broad artistic control and custom materials; additional geographic integration to own | Reserve for a specialised future scene |
| WebGPU-first custom engine | Access to newer graphics/compute capabilities; more compatibility and maintenance work | Research track after shipping |

The deck.gl alternative is real: `Tile3DLayer` supports 3D Tiles through loaders.gl. Its current MapLibre integration can share a WebGL2 context, but terrain draping is not automatic, globe integration has experimental aspects, and camera roll/custom vertical field of view are not fully synchronised. [Tile3DLayer](https://deck.gl/docs/api-reference/geo-layers/tile-3d-layer), [MapLibreOverlay](https://deck.gl/docs/api-reference/maplibre/overview)

NASA's `3d-tiles-renderer` offers Three.js and React Three Fiber integrations, with some specification exceptions. R3F provides demand rendering, but introduces another integration surface rather than removing the tile-delivery problem. [Renderer repository](https://github.com/NASA-AMMOS/3DTilesRendererJS), [R3F performance guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)

## Scene and feature boundaries

Use **one active map canvas and one geographic camera**. Do not stack Cesium, MapLibre, deck.gl and R3F canvases to implement the first release. If the challenger wins the benchmark, switch the map adapter; do not retain both engines running. A small adapter should expose actual product needs such as `flyTo`, `setSelection`, `setMode`, `setQuality` and `dispose`, without attempting a universal rendering framework.

| Experience | First implementation |
|---|---|
| Explore | Textured 3D Tiles, limited POI markers, selected destination highlight |
| Transport | Visible stops/stations and selected route geometry; ETA cards in HTML; no claimed live vehicle positions from ETA alone |
| Weather | Top-down view with mesh suppressed; bounded rainfall frames over a simple basemap, station measurements and a clear legend |
| Indoor | Focused floor view, selected venue only; floor selector and amenities; restore outdoor camera on exit |
| CCTV | GPU map markers plus a lazily loaded HTML image card; refresh only selected/visible images |

**Rain imagery is not automatically painted onto the roofs of a photogrammetry mesh.** Cesium's ordinary imagery providers target globe imagery, so opaque city geometry can conceal the overlay. Use a readable top-down weather mode first. A surface draping or separate weather-volume effect must pass a dedicated composition prototype before being promised. [Single-tile imagery provider](https://cesium.com/learn/cesiumjs/ref-doc/SingleTileImageryProvider.html)

Keep rainfall values separate from colour rendering: preserve no-data cells, units, issue time and each forecast interval. Precompute frames or compact grids once per upstream release. Load a small frame window, reuse GPU textures, and change a uniform or texture reference during playback instead of rebuilding thousands of GeoJSON polygons. Crossfades are visual transitions between published forecast intervals, not extra meteorological predictions. Pause playback while hidden and on demand.

## Indoor compatibility is an early gate

The Lands Department indoor API returns venue-filtered JSON for floors, units, outlines, openings and amenity/occupant points. It advises venue-by-venue requests and limits a response to 5,000 records. This is structured map geometry, not a promise of a photorealistic indoor scan. [Indoor Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-map-api)

First fetch one supported station's layers and verify identifiers, counts, floor ordering, geometry, heights and exterior entrance alignment. Do not assume an unverified pagination option; detect capped responses and use documented subdivision/filtering or the downloadable dataset when necessary.

The city mesh is not guaranteed to provide a separate selectable object for every building. Selecting a search result cannot automatically remove that building's exterior. Start indoors with an isolated floor scene or hide the outdoor mesh. Then prototype a footprint cutaway using Cesium clipping polygons and, where necessary, globe/terrain clipping; test underground visibility, missing walls and camera collision explicitly. Cesium supports clipping regions on tilesets, models and the globe in WebGL2. [ClippingPolygonCollection](https://cesium.com/learn/cesiumjs/ref-doc/ClippingPolygonCollection.html)

Store horizontal CRS, coordinate order, source height and vertical datum separately. An EPSG:4326 response does not prove its Z values are ellipsoidal heights. WGS84 ellipsoidal height and Hong Kong Principal Datum differ; a normal horizontal reprojection is insufficient. Preserve floor identifiers rather than deriving floors from a fixed storey height. Validate against known entrances and connecting pedestrian edges; use documented height transformations if needed. [Lands Department height explanation](https://www.geodetic.gov.hk/en/gi/height_transf.htm), [official transformation service](https://www.geodetic.gov.hk/en/services/tform/tform.aspx)

## Performance plan

Use the first device measurements to tune these provisional policies:

- **Visible work only:** load tiles by camera/LOD; request POIs within the visible area; fetch an indoor venue only on selection. Cluster distant markers and constrain labels. Use collections/batched geometry for dense overlays. Avoid one React component or DOM element per map feature. [BillboardCollection](https://cesium.com/learn/cesiumjs/ref-doc/BillboardCollection.html)
- **Render on change:** use `requestRenderMode`; explicitly request a frame after externally driven changes. Set `maximumRenderTimeChange` deliberately, rather than letting a ticking clock invalidate every idle frame. Playback temporarily requests animation frames. Stop it when the page is hidden. [Scene options](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html), [Cesium explicit-rendering explanation](https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/)
- **LOD and memory:** tune `maximumScreenSpaceError` upward on weaker devices, use dynamic/foveated refinement, and bound `cacheBytes` together with `maximumCacheOverflowBytes`. These are estimated tile memory controls, not a measurement or cap of the whole browser. Test skipping LOD; it is not automatically optimal for every tileset. [Cesium3DTileset options](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html)
- **Android resolution:** begin with an effective device pixel ratio near 1 on phones and refine only after profiling. Avoid paying for every physical screen pixel by default. Cap postprocessing, transparent passes and shadows; lower quality during interaction if measured stalls justify it. Cesium exposes resolution controls. [CesiumWidget](https://cesium.com/learn/cesiumjs/ref-doc/CesiumWidget.html)
- **Separate heavy data work:** normalise bulk rainfall/geometry server-side or in workers. Do not claim the tile loader is entirely off-thread: loaders.gl explicitly lists no worker support for `Tiles3DLoader` itself, although specific subloaders may differ. [Tiles3DLoader](https://loaders.gl/docs/modules/3d-tiles/api-reference/tiles-3d-loader)
- **Stable data lifetimes:** reuse geometry and textures; update selected attributes; dispose resources on venue/engine teardown. Hidden resources still consume memory, so retain a small bounded working set. deck.gl likewise warns that changing data references rebuilds buffers. [deck.gl performance guidance](https://deck.gl/docs/developer-guide/performance)

Progressively show the interface, basic map and selected-area content. Expose a quality control and a useful list/search fallback. A list should remain usable if 3D fails. Add mobile context-loss recovery and test background/resume, prolonged interaction and thermal slowdown; a short desktop FPS capture is insufficient.

## Tile access and backend implications

The official textured-map API supplies Cesium 3D Tiles in WGS84 and requires a free key obtained from Lands Department. Its documentation describes shared bandwidth/concurrency limits and fair usage, not a guaranteed public hosting SLA. A small API backend should aggregate transport and preprocess weather, but proxying every 3D byte by default could increase latency and hosting cost. [3D Visualisation Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api)

Before choosing direct delivery versus a tile gateway, inspect the root manifest, nested manifests, binary models, external textures, redirects, CORS, cache headers and actual key policy. A successful root JSON request does not prove the model renders. Relative child requests must retain the required authentication; Cesium `Resource` has derived-resource/query handling, but verify the actual nested URLs in a browser. [Resource API](https://cesium.com/learn/cesiumjs/ref-doc/Resource.html)

If a key is intended to be secret, keep it server-side. If the provider allows a browser-scoped public key, apply its supported restrictions. A gateway must allowlist upstream paths, preserve/rewrite the full resource graph correctly, cache only as permitted and avoid an open arbitrary-URL proxy. A CDN cannot make uncached bytes arrive faster than the original upstream indefinitely; profile both paths. Self-hosting or repackaging a limited downloaded area can be evaluated later against storage, update and terms obligations.

Retain the provider's logo/copyright requirements on the map, including mobile layouts, plus applicable tile/source credits. Include those requirements in the design system so overlays do not hide them. The indoor API explicitly requires Lands Department logo and attribution. [Indoor Map API requirements](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-map-api)

## Bounded renderer benchmark

Allow roughly two focused implementation days for a Cesium proof and one day for the challenger if needed. These are planning estimates, not delivery promises. Record exact dependency versions and fixture revision. Do not infer compatibility from packages all being individually marked latest.

1. Use the same small HK tile subtree, overlays, camera path, visual quality target and viewport. Compare approximate output detail rather than identical SSE numbers, whose meaning/selection behaviour varies by engine.
2. Test laptop Chrome and the actual Android phone's Chrome. Record model, OS, browser, GPU when exposed, viewport/DPR, connection and temperature conditions. Add a second modest Android before widening beta.
3. Run cold and warm loads separately, repeating a fixed harbour-to-street-to-station journey. Measure useful-map time, transferred bytes, failed/aborted requests, tile refinement, input delay/long tasks and p50/p95 frame time during movement. Record 10–15-minute stability, background/resume and context loss. Report engine estimates separately from JS heap; portable exact GPU memory is not assumed available.
4. Include rainfall playback and the selected indoor floor. A faster blank basemap does not decide a textured-city benchmark. A higher FPS score achieved by dropping overlays or clipping correctness does not win.
5. Proposed gate: first meaningful map within 3 seconds on the defined warm path; interaction p95 frame time under 33 ms on target Android and under 20 ms on laptop; cached floor switching under 300 ms; no crash during the prolonged journey. Set cold-load byte/time budgets from actual source tiles before committing to a promise.
6. Keep Cesium if it meets the gates. Adopt the challenger only for a repeatable material advantage on the same experience without unacceptable terrain/indoor compromise. If both miss, reduce tile scope/detail and active layers before investing in a custom engine.

## WebGPU decision

Use WebGL2 for the production baseline. Current deck.gl documentation marks WebGPU as work in progress and not production-ready: many layers now have ports, while base-map interleaving is unsupported and some extensions/transitions are incomplete. Three.js `WebGPURenderer` has WebGL2 fallback, but its manual still notes experimental status and unsupported legacy material/postprocessing paths. Neither is a guarantee of a faster app. Keep renderer-independent data contracts so a later measured migration remains possible. [deck.gl WebGPU status](https://deck.gl/docs/developer-guide/webgpu), [Three.js WebGPU manual](https://threejs.org/manual/en/webgpurenderer)
