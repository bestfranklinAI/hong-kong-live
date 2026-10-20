# Continuous journey guidance

The route planner, active walking card and route floor plans now share a manual position in the government direction sequence. Viewing another map does not advance it. Continue opens the relevant map, and an explicitly matched floor requires confirmation while that floor is displayed. Replacing the route clears progress and confirmations.

## Automated checks

`pnpm check` passed: TypeScript, ESLint, 244 tests across 71 files, and the production frontend build. The existing unnecessary-hook-dependency warning, React test `act` warnings, dependency annotation warnings and large-bundle warning remain nonfatal.

The new tests cover the captured Kowloon–Jordan direction sequence, intermediate venue linking, ambiguous floor and venue names, Traditional Chinese names, partial numbered-floor rejection, and missing indoor coverage. The interactive guide test covers delayed indoor loading, manual confirmation, browsing another floor, uninterrupted same-floor visits, source connectors, returning to an earlier floor, manual completion and replacement-route reset.

## Browser replay

Headless Chromium exercised the application using the recorded `kowloon-jordan-route-2026-10-17.json` route and floors. Route and indoor responses were intercepted; other external requests were blocked. This is a deterministic UI replay, not a live routing or source-availability check.

The replay ran at 412×915, 360×640 and 1280×900. It planned a route through the normal destination search and route form, then exercised the first 16 of its 82 source instructions: opening the platform floor, selecting another floor without confirming, returning to the required floor, confirming, passing the source lift/escalator instructions, confirming subsequent floors and returning to the city map for the footbridge section. The smaller-phone and desktop runs also switched to the city tab and reopened the floor plan without advancing the instruction or losing its confirmation. Starting and ending GPS guidance retained the current source instruction. Browser error collection was empty. Screenshots are in ignored `output/playwright/`.

## Evidence limits

The links identify explicit source venue/floor names; they do not establish the user's position or independently verify connections. Unmatched sections retain their original direction text and city view, which can include indoor sections. Source connectors are not assigned an inferred floor or mapped feature location. Confirmation is the user's statement after checking signs. Current entrance permissions, lift availability, physical Android gestures and real-world indoor navigation require separate validation.
