# First-slice verification

Date: 13 September 2026. This is a local functional verification of the first Explore slice, not a completed public-beta or physical-device performance benchmark.

## Reproduce

Use Node 24 and pnpm 11.19.0. Install from the repository lockfile with `pnpm install --frozen-lockfile`, then run `pnpm check` and `pnpm format:check`. Start both local servers with `pnpm dev`.

The tested host reports Node 24.20.0. Its bundled pnpm uses Node 24.19.0 internally. Package installation required a longer network connection-selection window and download timeout on this connection; see the README workaround. TLS verification remained enabled. Only esbuild's required dependency build is allowed in workspace configuration.

## Automated checks

Final `pnpm check` passed at 15:08 HKT; `pnpm format:check` also passed.

- TypeScript checks the web app, renderer, API and shared packages together.
- ESLint checks the authored TypeScript/React code.
- 45 tests cover provider parsing and timestamps, request bounds/retries, cache singleflight and expiration, HTTP validation, place provenance/search, URL validation and browser-side feed expiry.
- Prettier checks authored code/configuration and implementation documentation; original research and the accepted plan are preserved.
- Vite produces a production build with separate lazy renderer JavaScript and copied Cesium runtime assets.

Tests use injected fetchers and dated fixtures. They do not load-test public government services. A real request succeeding during browser review does not prove continuing upstream availability.

## Browser review

Reviewed in the Codex in-app Chromium browser at 1280×720 and 1440×900 laptop layouts, plus a 390×844 phone layout. This emulates layout, not Android CPU/GPU, touch latency, thermal behaviour or browser compatibility.

Verified through the interface:

- Basemap and geographic markers render without an ion token; OpenStreetMap and Cesium credits remain visible.
- Traditional Chinese searches such as `大館` and `太平山` return the expected places; unmatched queries show an empty state and recover when cleared.
- Selection opens sourced details; URL state restores selection and query on reload.
- Categories/search survive mode changes. Bookmarks persist after reload; saved-only and empty-bookmark states work.
- HKO observations and MTR departures return real provider data with separate source times. Delayed HKO data was visibly labelled; missing readings are not invented.
- Changing MTR stations preserves an expanded phone panel and does not cover departures with an Explore detail card.
- Selected mobile details receive keyboard focus and the collapsed discovery content is inert.
- Mobile camera framing keeps the selected Peak marker around screen y=330, above the detail card beginning around y=463 at 390×844.
- About opens with focus on its close control; Escape restores focus while retaining the selected place.
- Zoom, tilt, north, reset and graphics-quality controls respond. Desktop and phone layouts have no horizontal document overflow.
- The compact laptop layout exposes two complete place rows at 1280×720.

Screenshots were inspected during this review. Browser console errors/warnings were empty after the main journeys. The production preview on port 4173 also rendered the map and credits successfully, and its API proxy returned a healthy live-mode response. This is a manual smoke test, not a checked-in end-to-end regression suite.

## Build size and remaining measurements

The final production build reports 166.10 kB gzip for the interface JavaScript and 1,053.74 kB gzip for the lazy Cesium scene. The interface is below the plan's provisional 250 KiB compressed budget. The renderer is a substantial additional transfer, and map tiles add further bytes. Copied runtime assets are available on demand; their total disk size is not the same as initial network transfer.

Vite warns about large chunks. Zod also produces two removable annotation warnings during bundling. These warnings do not fail the build; they remain visible rather than being suppressed.

The following remain open release gates:

1. Project-authorised LandsD tiles, dependent requests, attribution and indoor data coverage.
2. Equivalent-data Cesium versus MapLibre/deck comparison and any required 2D fallback.
3. Physical Android cold/warm loading, gesture frame times, idle draws, WebGL context recovery and a 10–15 minute stability run.
4. Field Core Web Vitals, measured useful-scene readiness and transfer budgets under a recorded network profile.
5. Rainfall, CCTV, bus/minibus and indoor layers; global cache coordination and reviewed public hosting.

No paid Cloudflare resources, public deployment, secret provider key or user account system is part of this first slice.
