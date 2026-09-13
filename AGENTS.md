# Hong Kong Live

Use Node 24 and pnpm 11.19.0. Read README.md before changing runtime or deployment assumptions.

## Commands

- `pnpm dev`: local web and API servers.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`: required checks for relevant code changes.
- Screenshots and browser traces go in ignored `output/playwright/`.

## Boundaries

- `packages/contracts`: semantic types and runtime validation; no React or provider I/O.
- `packages/providers`: provider adapters, source-time interpretation and cache logic.
- `apps/api`: HTTP validation and provider orchestration; never arbitrary URL proxying.
- `apps/web/src/scene`: imperative renderer lifecycle; never route animation frames through React state.
- `apps/web/src/features`: user-facing feature modules; share only genuinely reusable UI.

Keep files focused, name concepts plainly and comment decisions or non-obvious source semantics. Avoid comments that narrate obvious syntax. Dispose renderer resources and cancel obsolete work. Keep geographic data and credentials out of UI stores.

Never invent live readings, vehicle positions, indoor coverage or measured performance. Fixture mode must be visibly labelled. Preserve source timestamps independently from fetch times. Public `VITE_*` configuration is never secret.

See IMPLEMENTATION-PLAN.md for the approved direction, docs/design/ for visual rules and docs/architecture/ for implementation decisions. Do not treat planned phases as completed features. Source availability and physical Android performance require their own evidence.
