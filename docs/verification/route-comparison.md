# Route comparison and preferences

Compare routes requests the missing Recommended, Shortest and Barrier-free profiles for a shared pair of resolved mapped endpoints. The selected route stays available while other profiles load or fail. Cards retain actual source time/distance estimates and expose instruction mentions, unrouted gaps, warnings and source fetch times. Choosing another result updates the route and resets the manual journey; successful alternatives can be reused without refetching.

## Automated coverage

`pnpm check` passed: typecheck, lint, 254 tests across 74 files and the production build. Existing nonfatal hook-dependency, React test `act`, dependency annotation and bundle-size warnings remain.

The added tests cover recognised English/Traditional Chinese connection instructions, unknown accessibility when instructions are absent, identical paths, source estimate deltas and changed endpoint connections. Interactive comparison tests verify on-demand requests, shared endpoints, partial failure, per-profile retry, selection without refetching, cancellation on endpoint changes/unmount, late-response rejection, malformed and mismatched profile/language responses, and 45-second timeouts. Preference tests verify persistence, validation of stored enums, compatibility with older preferences and exclusion of route/coordinate data.

## Browser replay

The application replay uses the recorded Kowloon–Jordan route and floor geometry with intercepted route and indoor API responses. Each requested profile receives the same captured route with its request echoed; this intentionally exercises identical-path presentation and does not constitute a captured live three-profile comparison. One Barrier-free request returns a test failure before succeeding on retry. Other external requests are blocked, and GPS is simulated at the captured origin.

The replay passed at 412×915, 360×640 and 1280×900 with no browser errors. It checks request counts, shared endpoints, retaining the original route during partial failure, selecting Shortest without refetching, retrying Barrier-free, displaying its source stair/escalator caution, inspecting connection gaps, collapsing/reopening cached results, starting/stopping guidance and retaining the preferred profile after reload. The existing Phase 1 journey browser replay also passed after these changes. Screenshots are saved in ignored `output/playwright/`.

## Limits

No new accessibility properties are inferred from heights or floor polygons. The UI reports recognised direction wording and the selected official profile only. Live profile differences, current equipment operation, wheelchair suitability and physical Android performance require their own validation.
