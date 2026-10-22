# Mobile experience verification

## Map-first navigation update · 22 October 2026

Node 24.20.0 and pnpm 11.19.0: `pnpm check` passed (typecheck, lint, **354 tests in 90 files**, production build); `git diff --check` passed. The existing StationFloorPlan dependency warning, indoor-test `act(...)` warnings and Zod/build-size notices remain. Output: ignored `output/playwright/map-first-check.log`.

Browser checks used the local fixture-mode API, the dated Kowloon–Jordan route/floor recording intercepted in Playwright, and explicitly labelled simulated GPS. Source timestamps were retained. Checked 390 × 844, 320 × 740 and 1440 × 900 layouts, collapsed/expanded source text, floor confirmation, indoor/city continuity, Journey details, map settings, and automatic versus manual step controls. Missing indoor layout fixtures returned 503 and kept the unavailable-geometry notice; no indoor geometry was fabricated.

At 390 × 844, the collapsed floor-confirmation and Austin concourse cards measured about 198 px tall; the tested visible controls were at least 44 × 44 px, with no horizontal overflow. Long source instructions stay intact when expanded. The compact integration test verifies that a GPS cursor beyond a floor cannot bypass confirmation, browsing does not confirm it, a return visit needs confirmation again, and a new step collapses the instruction disclosure.

Screenshots: `output/playwright/map-first-mobile-austin.png`, `map-first-mobile-floor.png`, `map-first-mobile-automatic.png`, `map-first-mobile-expanded.png`, `map-first-narrow-floor.png`, `map-first-narrow-details.png`, `map-first-narrow-indoor.png`, and `map-first-desktop.png`. These are layout and interaction checks, not physical Android GPS, compass, performance or source-availability evidence.

## Earlier verification · 19 October 2026

19 October 2026. Local development app, live API mode. Test coordinates are public Kowloon-area points, not a captured user location.

## Automated checks

Node **24.20.0**, pnpm **11.19.0**:

- `pnpm typecheck`: passed.
- `pnpm lint`: passed, with one existing `useMemo` dependency warning in `StationFloorPlan.tsx`.
- `pnpm test`: **330 tests passed in 82 files**. Existing indoor render tests emit React `act(...)` warnings.
- `pnpm build`: passed. Existing Zod annotation and bundle-size warnings remain.
- `git diff --check`: passed.

The full check output is in ignored `output/playwright/ux-check.log`; the final build output is in `output/playwright/ux-build.log`.

New behavioral coverage includes waiting through coarse or stale origin fixes, cancellation and acquisition timeout cleanup, explicit GPS retry, wider navigation camera framing, and symbols derived from explicit source instructions. Existing tests cover route replacement, lost-fix expiry, floor confirmation, shared journey state, indoor floor selection and route comparison.

## Browser checks

Browser viewport emulation is layout evidence, not a physical phone benchmark.

- Phone: 390 × 844; narrow phone: 320 × 640; desktop: 1440 × 900.
- Plan through editable fields using public points near Kowloon (`22.304255, 114.161444`) and Jordan (`22.305, 114.171`). The live government route returned 1,596 m, approximately 27 minutes, 56 source instructions, with Kowloon and Austin station sections. This is one successful response, not a guarantee of permanent provider availability.
- Start walking, advance a step, open its matched Kowloon floor, confirm Platform Level 2, close the indoor plan, inspect Journey details, and end walking.
- Check the mode-specific weather/transport headers, station selector disclosure, live train times, bus route form, camera browser, HKO readings/rainfall states, map settings and place browsing.
- Verified that a shared Victoria Peak URL opens a dedicated mobile detail view, with its primary Directions action visible and a return to places. The old list no longer remains above the selected content.
- At 320 px, the document scroll width equals its client width; the active navigation dock fits the viewport.
- HKO observations returned a live station report during the check. The rainfall source was too old to display; the interface correctly showed it as unavailable rather than rendering an expired forecast.
- Screenshots are kept in ignored `output/playwright/ux-*.jpg`.

## Limits

No browser permission was granted to capture a real user location. Continuous GPS, stale/poor fixes, cancellation and retry are verified with deterministic tests. The camera's 260 m framing is verified in a renderer unit test; real movement and heading feel need an outdoor walk.

Still required: real Android Chrome, physical precise-location permission and reported accuracy outdoors/between buildings, compass orientation, changing signal quality, screen wake lock behavior, actual on-device keyboard/safe-area behavior, two-finger gestures and frame/memory measurements. Indoor positioning and live lift status are not provided. A phone screenshot must not be described as proof of any of these.
