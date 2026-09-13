# Interface foundation

Hong Kong Live is an exploration tool for Android phones and laptops. The interface should make places and source information easy to find while leaving room for the map.

## Visual system

- Warm paper and ivory surfaces, forest-green actions, quiet lime highlights.
- Readable system fonts with a clear hierarchy. English and Traditional Chinese place names stay together.
- One persistent discovery panel on desktop; an expandable panel on mobile.
- Three top-level modes: Explore, Weather and Transport. Each mode explains its available coverage.
- One selected-place card, one map-control group and visible source attribution.
- Decorative contour artwork in the Peak discovery card is interface decoration, never presented as geographic data.

Tokens are defined in `apps/web/src/styles.css`. Components use shared classes rather than repeating raw colour values. Scene-specific geographic colours live with the renderer.

## Interaction rules

Search works without hover. Controls have accessible names and focus styles. Place cards have distinct selection and bookmark buttons; no nested interactive elements. Scrolling a panel must not move the map. Saved places remain on the device; selection and mode are shareable through the URL. The About dialog traps focus through Base UI and restores it when closed.

Reduced-motion preferences apply to CSS and camera flights. Avoid decorative continuous animation, broad canvas blur, or per-frame React updates. Weather and transport failures must be visible. Unknown source times stay unknown.

## Skill application

The requested UI/UX Pro Max SKILL.md was read. Its `scripts/search.py`, reference files and searchable database were missing from the installed skill and no alternate copy was found in available skill roots. This is a manually authored design system using its supplied accessibility, touch, performance and layout priorities, not generated database matches.

## Visual verification

Review at a laptop viewport and an Android-sized viewport. Check default exploration, a selected place, empty search, saved filtering, weather/transport failure states, the expanded mobile panel and the About dialog. Record screenshots under ignored `output/playwright/`. Layout emulation does not establish physical Android GPU performance.
