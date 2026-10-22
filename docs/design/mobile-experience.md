# Mobile interface and user journeys

Updated 22 October 2026. This is the current interface direction; source availability and physical phone performance still need their own evidence.

## Product intent

Help someone decide where to go, see a walking route, and follow its instructions while keeping the map visible. Weather, departures, cameras, and indoor plans support that journey. Every surface should answer a concrete question and offer a clear next action.

Three modes remain: **Navigate**, **Weather**, and **Transport**. Indoor maps belong to a place or a journey; cameras belong to Transport. Map settings is the single home for basemap, language, dimension, 3D presentation, and graphics quality. In-map controls manipulate the camera only.

## Information and actions by surface

| Surface               | User goal                              | Show first                                                                                                                                   | Reveal on request                                                                             |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Navigate, collapsed   | Start a journey                        | Map, “Where to?”, locate action                                                                                                              | Planning form                                                                                 |
| Plan a walk           | Set start and destination              | Labelled editable From/To fields, three route profiles, Find walking route                                                                   | Language and obscured-route options; indoor catalogue                                         |
| Search                | Choose a specific mapped result        | Bilingual name and distinguishing address; one selection action                                                                              | Source and search-interpretation details already supported by search                          |
| Route preview         | Decide whether to walk                 | Destination, estimated minutes and metres, Start walking                                                                                     | Compare routes, Edit journey, station plans, all directions, source limits and height profile |
| Walking               | Read and act on the current step       | Top instruction bubble, explicit manoeuvre/level cues, automatic outdoor progress, estimated remaining distance, locate/recentre, end action | Journey details: GPS accuracy/retry, full directions, route source                            |
| Indoor guidance       | Check the right floor and continue     | Venue, floor selector, plan, current instruction, floor confirmation                                                                         | Map options, source geometry, amenities and full directions                                   |
| Place browsing        | Find something nearby or saved         | One mobile search field, one category strip, result list and labelled Saved filter                                                           | Desktop selected-place categories; facility coverage/source                                   |
| Selected place or pin | Decide what to do here                 | Name, address/district, reference-location caveat when applicable, Directions                                                                | Description, published venue details, coordinates, copy action, provenance                    |
| Weather forecast      | Choose a weather layer                 | Windy map, weather-layer selector, HKO observations switch                                                                                   | Spot forecast and reset remain secondary controls                                             |
| HKO observations      | Inspect a station reading and rainfall | Station selector, temperature/humidity with their observation times, source state; rainfall period, playback and legend when available       | Fetch times, rendering style, reference HKO report, source explanation                        |
| MTR                   | Find the next departure                | Compact selected-station control, arrivals and platforms                                                                                     | Change line/station, map-illustration settings and coverage                                   |
| Buses                 | Choose a stop and see arrivals         | Selected route disclosure, stop selector, next arrivals                                                                                      | Operator/route/direction/service search, nearby-stop discovery, source coverage               |
| Cameras               | Inspect a road                         | Road search, district selector, selected still and location list                                                                             | Provider/source information                                                                   |
| Settings              | Adjust the map intentionally           | Labelled form controls                                                                                                                       | Credits, loading diagnostics and data explanations                                            |

Missing, delayed, unavailable and fixture states remain visible. A timestamp, warning or absence of data must not become a reassuring “live” badge merely to reduce copy.

## Primary journey

1. Tap **Where to?**. The sheet opens; the map stays in place.
2. Type directly into Destination. Search accepts place names, coordinates and supported map links. Select a mapped result explicitly.
3. Keep Current location or enter a starting point. Location-based planning waits for a usable fresh fix; an imprecise position cannot silently become the route origin.
4. Find the walking route. Read destination, minutes and metres. Start walking is the primary action; comparisons and edits are secondary.
5. Start walking. Replace the discovery sheet with a compact top instruction bubble. The current step never shares a scroll position with route explanations.
6. Outdoor instructions advance with approximate GPS progress. Indoor sections, bridges and level changes keep a **Next** action so a street-level fix cannot silently skip an elevated section. Check signs and confirm explicitly matched floors; the walking card accepts that confirmation directly.
7. Browse the map freely and use **Recentre** to resume follow. Open Journey details for location diagnostics or the full source directions; closing it returns to the same step.
8. End walking to return to the route preview. Switching modes stops active GPS guidance but retains the route in session, so returning to Navigate offers that route again. A reload is not route persistence.

Tapping the already-selected mode must not clear the current route. Starting a separate discovery/browse task can clear it. Indoor and city views share one journey cursor, so changing maps never silently skips a step.

### Map-first walking

While walking on mobile, the mode bar and station tabs give way to one compact card, 12 px from the top safe area. Its two-line instruction expands on tap to show the full, unchanged source text, step count and Back control. Each new step starts collapsed. A contextual row appears for the current floor, connector, indoor plan or required manual progress; an unconfirmed mapped floor uses one explicit confirmation action rather than repeating the floor name in several places. Outdoor GPS progress needs no persistent explanation or Next button.

The footer keeps estimated distance, an icon-only locate/recentre control, Journey details and End. Every visible control is at least 44 × 44 px. Destination, station-map browsing, map settings, route update, GPS diagnostics and the full directions are in Journey details. Floor checks suppress the generic XY off-route prompt; manual route update remains available in details. Errors and source attribution stay visible. The card can scroll up to 55% of the mobile viewport when deliberately expanded or when content needs more room; its ordinary collapsed state is substantially smaller.

## Visual system

The map supplies the visual richness. The interface uses solid white surfaces, quiet neutral borders and one forest accent. Avoid decorative hero copy, oversized marketing headings, nested pill containers and large canvas blur effects.

| Token              | Value     | Purpose                          |
| ------------------ | --------- | -------------------------------- |
| `--paper`          | `#f5f6f3` | Application background           |
| `--surface`        | `#ffffff` | Panels, dialogs, controls        |
| `--ink`            | `#1d332e` | Primary text                     |
| `--muted`          | `#596b64` | Secondary copy and labels        |
| `--forest`         | `#145c4a` | Primary action and selected mode |
| `--forest-hover`   | `#0e4639` | Primary hover                    |
| `--line`           | `#dce4de` | Boundaries and separators        |
| `--soft`           | `#f1f5f2` | Secondary surfaces               |
| `--radius-control` | `12px`    | Buttons and inputs               |
| `--radius-panel`   | `20px`    | Desktop panels and dialogs       |

Mobile bottom sheets use 24 px top corners. The walking bubble uses 20 px corners and 12 px side margins. Default phone side margins are 16 px; the floating mode bar uses 12 px. Use the spacing steps **4, 8, 12, 16, 20, 24**. The essential information should fit a preview; longer lists scroll inside the sheet without scrolling the map.

### Typography

Use the installed system UI font: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Noto Sans TC`, then `sans-serif`. This avoids a font download and makes English and Chinese use the device's available fonts. Do not describe an unbundled font as the active typeface.

- Screen headings: 22–24 px, weight 650, modest negative tracking.
- Walking instruction: 18 px, weight 600, line height 1.45; 16 px on the narrowest phones.
- Editable input text: 16 px; visible From/To labels: 12 px, weight 600.
- Action text: 14–15 px; compact mode/category text: 13 px.
- Supporting text: 12–14 px, line height at least 1.5 where it spans lines.
- Legal map attribution may use the provider's compact treatment; it stays visible.

### Control grammar

- A solid forest button means the main next action. Prefer one per state; floor confirmation can temporarily gate Continue.
- A bordered white/soft button means an optional action. No unframed text that appears actionable only on hover.
- Selected segmented controls have a filled accent and an accessible selected/pressed state.
- Label text is quieter and sits above its input. Placeholder text supplements the label.
- Disclosures use a divider, a clear label, a chevron and at least 44 px of activation height.
- Icon buttons have an accessible name and at least a 44 × 44 px target. Phone locate is 48 × 48 px.
- Keep visible focus rings. Preserve native selects, keyboard access, reduced-motion support, safe-area padding and focus return from dialogs.
- Manoeuvre icons reflect explicit source text (left, right, forward, lift, stairs, escalator, ramp). An icon must not invent a turn or imply verified equipment.

## Progressive disclosure and duplication

The route preview no longer includes a second live instruction controller. Walking shows one instruction controller; its full source list is in Journey details. When the correct indoor floor is already visible, do not display another “view this floor” action. Keep the current instruction intact rather than rewriting official route semantics to make it shorter.

One mobile category strip replaces overlapping curated Arts/Parks and official Museums/Parks controls. Saved places have a labelled filter in the result list. Desktop map settings no longer duplicate the same controls on the canvas. Weather shows one selected-station reading surface; the general HKO reference report is optional. Arrival illustrations are secondary to the actual departure list. Generic repeated train remarks are omitted when the list already labels times as estimates; operational remarks remain.

On phones, selection replaces the browsing list with a dedicated detail view and one Back to places action. Reset that view to the top; a shared place URL opens its details directly. Programmatic title focus announces the change without expanding the sheet or styling the title like an editable field.

Hide secondary explanations, not missing-data states, floor confirmation, off-route alerts, unsupported coverage, provider attribution or fixture labels. Do not claim live availability, open entrances, working lifts or indoor positioning.

## Location and navigation behavior

The follow-camera range increases from 160 to **260 metres** in both 2D and 3D. Camera insets account for the visible navigation dock, preserving space for the route below it. Renderer smoothing stays in the scene lifecycle; no animation-frame updates enter React state.

Location is a browser/device estimate. `enableHighAccuracy` requests the best available source; it cannot guarantee a particular accuracy. See the [W3C Geolocation specification](https://www.w3.org/TR/geolocation/).

- Walking uses the existing continuous high-accuracy watcher, with a 3-second cache allowance and a 15-second acquisition timeout.
- Application guidance requires a finite nonnegative reported accuracy of at most 60 m. This is a usability gate, not evidence of street-level accuracy.
- Planning now waits up to 20 seconds for a fix meeting that gate and no older than 10 seconds. It releases the watcher on success, failure, cancellation and unmount.
- Invalid coordinates, out-of-order fixes and positions older than 30 seconds are rejected by the watcher. A lost accepted fix expires; progress and camera following stop until a new usable fix arrives.
- Location continues updating automatically while walking. Journey details offers **Refresh location**, which replaces the GPS subscription without replacing the route. The locate action also retries when progress is unavailable.
- Outside pending level checks, automatic rerouting requires three distinct off-route fixes over at least eight seconds, each with reported accuracy at most 25 m. An on-route or uncertain fix resets this window; requests are at least 30 seconds apart. Keep the destination/profile and an explicit **Update route from here** retry action. A single drifting fix cannot trigger rerouting.
- Device GPS/precise-location permission, sky visibility and phone settings affect accuracy. Floors and entrances still require local signs and manual confirmation. Browser checks cannot verify physical sensor accuracy.

## Implementation map

- `apps/web/src/interface.css`: final semantic tokens and shared component presentation; imported after the established style sheets.
- `apps/web/src/features/mobile/mobile.css`: consolidated mobile layout, sheet geometry, safe areas and map controls.
- `DiscoverySheet.tsx`: sheet gestures and measured header height; no floating “full details” button obscuring content.
- `WalkingGuidance.tsx`: top bubble, measured camera obstruction and accessible details dialog.
- `JourneyGuide.tsx`: shared cursor presentation with GPS outdoor progress and explicit level checks, compact during walking.
- `walking-location.ts`: cancellable location acquisition and continuous watch semantics.
- `NavigationCamera.ts`: imperative follow-camera framing.

The installed UI/UX Pro Max skill in this session contained its instruction file but no search script, database or reference files. This pass used its built-in accessibility, touch-target, mobile-layout and progressive-disclosure rules, plus the existing project direction; no database-generated palette or typography result is claimed.

See [verification](../verification/mobile-experience.md) for actual browser coverage and remaining device checks.
