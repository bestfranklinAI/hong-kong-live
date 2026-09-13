# Mobile map experience

The mobile layout (up to 700px wide) uses a fixed, edge-to-edge 100dvh canvas, a translucent header capsule, and a nonmodal discovery sheet. Desktop keeps its existing sidebar and map controls.

## Interaction

- Peek is 128px plus the bottom safe area: search and horizontal category controls retain 44px touch targets. Half uses 45% of the visible viewport; expanded uses 88%.
- Drag the handle/header, flick to the adjacent snap, or tap the handle to cycle. Keyboard Arrow Up/Down also changes the snap. Fast gestures use a 0.45px/ms threshold; slower gestures choose the nearest point.
- A small requestAnimationFrame spring uses stiffness 300 and damping 25. Rendering stays outside React state. Reduced-motion preference makes snapping immediate. Pointer capture keeps drags off the underlying map.
- Only the expanded content scrolls. Half shows a summary and a full-details action; keyboard focus into its content expands it. Peek content is hidden from focus and accessibility navigation.
- Sheet settlement updates the map's overlay insets. Visual viewport changes adjust the sheet for the keyboard; safe areas pad the bottom. All timers/listeners and inline mobile styles are removed on cleanup or desktop transition.
- Locate Me requests location only after a tap, centres the map and reports failures. Browser permission and a secure origin are required by supported browsers. Compass appears after a camera rotation. Layer and settings buttons open the same appearance dialog.
- Map language, basemap, quality, tilted view and credits live in settings. Unconfigured 3D buildings are disabled, not presented as an available dataset. Active map-provider credits remain in a small watermark. Estimated train provenance remains visible.
- Windy retains one full-screen iframe, with its layer controls moved into the mobile sheet. HKO observations remain available. Search finds curated places, MTR stations and weather shortcuts; it is not a territory-wide business directory.

## Verification, 13 September 2026

107 unit tests, type checking, lint and formatting passed; production build passed with the existing Cesium bundle and Zod annotation warnings. New tests cover snap boundaries, directional flicks, nearest-point release and spring convergence.

Browser checks at 390 × 844 verified full-size canvas bounds, no horizontal overflow, half/expanded snapping, settings, search-to-station navigation and Windy controls. Chromium native touch emulation verified Peek → Half → Expanded → Half → Peek using pointer gestures. A live resize to 1280 × 900 verified that mobile transforms are removed and the desktop sidebar remains intact.

Screenshots are in ignored `output/playwright/` (`mobile-peek.png`, `mobile-half.png`, `desktop-preserved.png`, `mobile-windy.png`). These checks do not establish physical Android haptic behaviour, OS keyboard behaviour or measured device performance; those still need a real-phone check.
