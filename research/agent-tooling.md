# AI coding tools and workflow for Hong Kong Live

Checked: **13 September 2026**. This is a research recommendation, not an installation record. Official documentation and project repositories were inspected; these tools have not been benchmarked together on this project.

## Recommendation

Use the coding agent already in this workspace, a compact project brief, version-specific documentation, browser verification and actual performance traces. Start with **Codex + Context7 + the existing Playwright skill and Playwright Test**. Add **Chrome DevTools MCP** when measuring the first map prototype. Add **React Grab** if pointing at UI elements becomes a frequent part of design iteration.

Keep Graphify optional until there is enough code for cross-module navigation to become a recurring problem. A repository graph can help an agent find code; it cannot make the application's map render faster. The app itself does not need an LLM, MCP server, embeddings service or graph database for its initial public-data experience.

These are fit-for-purpose choices. No source checked establishes one coding agent or MCP collection as universally best for high-performance geospatial applications.

## Tool shortlist

| Tool | What the official project provides | Proposed use in this project | Decision |
|---|---|---|---|
| **Context7** | Current, version-specific library documentation and examples | Look up the exact installed Cesium, MapLibre, React and hosting APIs; follow links to original vendor documentation for consequential decisions | Baseline documentation aid |
| **Playwright CLI + skill** | Browser actions, selectors, screenshots and reusable agent workflow | Let the agent inspect local previews and reproduce UI bugs | Reuse the installed skill |
| **Playwright Test** | Repeatable browser tests | Commit tests for search, layer toggles, floor selection, stale feeds and phone layouts | Baseline project dependency |
| **Chrome DevTools MCP** | Chrome traces, performance insights, network inspection, console and screenshots | Diagnose slow startup, long tasks, repeated requests, interaction stalls and memory growth | Add for performance work |
| **React Grab** | Copies a selected UI element's component stack and source locations | Point to a panel or button and give the agent its actual source context | Optional development dependency |
| **shadcn MCP** | Searches and installs components from configured registries | Build consistent dialogs, menus, drawers, controls and command search | Optional; CLI also works |
| **Figma MCP** | Design variables, components and layouts; design/code workflows | Useful if Figma becomes the design source of truth | Defer until there is a design file |
| **21st MCP**, formerly Magic MCP | Component discovery and hosted UI generation, depending on account access | Explore alternative place-card or navigation compositions | Optional inspiration only |
| **Graphify** | A locally generated code knowledge graph with query and MCP access | Trace relationships among data adapters, schemas, workers and scene modules | Trial after the first integrated release |

Sources: [Context7](https://context7.com/docs/overview), [Playwright CLI](https://github.com/microsoft/playwright-cli), [Playwright Test](https://playwright.dev/docs/intro), [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp), [React Grab](https://github.com/aidenybai/react-grab), [shadcn MCP](https://ui.shadcn.com/docs/mcp), [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/), [21st MCP migration](https://github.com/21st-dev/magic-mcp), [Graphify](https://github.com/Graphify-Labs/graphify).

### Browser tools: complementary roles

Microsoft's Playwright repositories now explicitly distinguish **CLI + skills** for coding-agent workflows from **MCP** for persistent exploratory automation. Reusing the existing Playwright skill avoids installing another browser control layer solely because it is called MCP. Keep stable regression flows as committed Playwright tests so they can run without an agent. [Playwright CLI guidance](https://github.com/microsoft/playwright-cli), [Playwright MCP guidance](https://github.com/microsoft/playwright-mcp)

Chrome DevTools MCP is particularly relevant because speed is a primary product requirement. Its trace and network tools provide evidence for optimization decisions. It officially supports Chrome and Chrome for Testing; it does not replace Safari or physical-phone testing. Its documentation also discloses enabled-by-default usage statistics and optional CrUX requests; configure those deliberately when setting it up. [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)

**Map-specific limitation:** DOM inspection and React Grab can identify the map canvas or surrounding React controls. Individual buildings, rainfall cells and indoor geometry rendered inside WebGL are not ordinary DOM elements. This is an architectural reason to provide explicit map diagnostics rather than expecting a UI-selection tool to understand the whole scene.

Build a development-only diagnostic surface with:

- Current camera, mode, selected feature and floor.
- Active layers and their source timestamps.
- Pending requests, tile-load state and cache hits where measurable.
- Frame-time samples, render activity and scene-object counts where the engine exposes them.
- Fixed camera presets and a frozen data/time fixture for reproducible screenshots.

A small typed debug interface plus an on-screen diagnostics panel is sufficient. It can be called from browser tests; a custom MCP server is unnecessary initially. Exclude test controls and diagnostics from the production build.

### UI-generation tools: useful scope

React Grab is most useful for feedback such as “this bottom sheet covers the floor selector.” Its documented Vite integration uses a development-only import. Do not interpret the project's promotional speed claims as measured results for this app. [React Grab](https://github.com/aidenybai/react-grab)

shadcn MCP can search registries and add their components to the repository. Use it for the application shell; review the source and style everything through one set of tokens. It does not provide geospatial rendering, tile streaming or a performance guarantee. [shadcn MCP](https://ui.shadcn.com/docs/mcp)

The tool often described in older guides as “Magic MCP” is now **21st MCP**. Its old package is a compatibility proxy, and hosted generation requires the appropriate AI access. Component discovery and paid code access are separate from that generation entitlement. It is a possible source of layout ideas, but building the map around randomly combined catalogue components would add design and maintenance work. [Official migration and access notes](https://github.com/21st-dev/magic-mcp)

Figma MCP becomes worthwhile when there are actual frames, variables and components to reuse. Its official documentation recommends the remote server, and access depends on the client's support, Figma permissions, plan and seat. It is not a prerequisite for designing directly in the browser. [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/), [access and limits](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/)

## What “Graphify” means today

The name is ambiguous in articles and installation snippets. Use exact repositories and package identities:

| Project | Verified identity | Relevance |
|---|---|---|
| **Graphify** | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify); Python package **`graphifyy`**, with two final y characters; CLI command `graphify` | The main project relevant to the requested context-management idea |
| **Graphlore** | [yasinyaman/graphlore](https://github.com/yasinyaman/graphlore); the old `yasinyaman/graphify-mcp` URL redirects here | A separate wrapper around Graphify adding source spans and retrieval tools; Graphify already includes its own MCP server |
| **Madar** | [mohanagy/madar](https://github.com/mohanagy/madar); the old `mohanagy/graphify-ts` URL redirects here | A separate local TypeScript/Node repository-context tool; not another install name for main Graphify |

Main Graphify parses code locally using tree-sitter and distinguishes extracted relationships from inferred ones. Its code mapping does not require LLM calls; semantic processing of documents/media can use the assistant or a configured model backend. It offers an embedded MCP server and project-scoped agent integration. A hosted platform is also advertised, so “Graphify” does not automatically imply that every mode stays local. [Main repository](https://github.com/Graphify-Labs/graphify), [hosted and local MCP options](https://graphify.com/mcp)

Graphlore states that it ships no extractor: Graphify builds its graph. Some richer retrieval and non-Python source-span functions need optional dependencies. That is additional machinery without an established need in this new repository. [Graphlore](https://github.com/yasinyaman/graphlore)

Madar focuses on task-specific context packs for TypeScript/Node repositories, with local graph creation. Consider it only as an alternative in a later context-tool trial, rather than layering it on top of Graphify from the outset. [Madar](https://github.com/mohanagy/madar)

### Proposed adoption gate

After several data adapters and rendering modules exist, select five real tasks: trace ETA freshness, locate camera state changes, identify rainfall parsing, assess a place-schema change, and find indoor floor transitions. Compare plain file/symbol search against one graph tool using the same code revision and task definitions.

Record correct relevant files found, missed dependencies, time spent, context volume, graph-build cost and manual corrections. Keep the graph only if it improves actual task completion. Treat repository-published benchmark ratios as author-reported evidence, not a forecast of savings here.

If adopted:

- Prefer local code-only indexing first; exclude raw geodata, 3D tiles, credentials, generated files, build output and dependencies.
- Record the source commit and refresh after structural changes. Consult the actual current source before editing.
- Retain the distinction between observed and inferred links.
- Keep architecture decisions and data contracts in reviewed Markdown; do not make the generated graph the source of truth.
- Review generated instruction/config changes before committing them. Pin the chosen package version and keep an easy disable path.

The main project is actively changing, and its README advertises hosted early access. That makes it a reasonable experiment, rather than a dependency on the critical path to shipping a small app. [Graphify repository](https://github.com/Graphify-Labs/graphify)

## Agent choice and costs

**Use Codex as the primary agent for this project**, because it is already the working environment. Official OpenAI documentation supports project instructions, reusable skills and local/remote MCP connections. There is no need to change tools to get those capabilities. [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills), [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

**Claude Code** is a reasonable alternative terminal-oriented agent with tools, context management and an execution environment. **Cursor** is a reasonable alternative when integrated editor/browser interaction is the preferred workflow. Pick one primary environment; use a second for a bounded independent review only if it provides value. No comparative benchmark was performed here. [Claude Code architecture](https://code.claude.com/docs/en/how-claude-code-works), [Cursor browser](https://cursor.com/docs/agent/tools/browser)

Start without additional paid agent subscriptions. Context7 has a free plan; its checked pricing page lists 1,000 monthly calls, while Pro includes 5,000 calls per seat with billed overage. Graphify local code parsing avoids a separate model bill, but document semantics, hosted services and the coding agent can have their own costs. Figma and 21st access are account-dependent. Verify account limits at adoption rather than treating “open source MCP” as “every connected service is free.” [Context7 pricing](https://context7.com/plans), [Graphify](https://github.com/Graphify-Labs/graphify), [Figma access](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/), [21st access](https://github.com/21st-dev/magic-mcp)

## Repository context that should exist before more plugins

Recommended documents, to create during implementation:

| File | Purpose |
|---|---|
| `AGENTS.md` | Short commands, code boundaries, invariants and completion criteria |
| `docs/product.md` | User journeys, included scope and deferred features |
| `docs/architecture.md` | Module responsibilities, data flow and deployment choices |
| `docs/adr/` | One decision per file: rendering engine, backend cache, coordinates/heights, weather representation, indoor alignment |
| `docs/data-contracts.md` | Dataset provenance, schema, units, times, CRS, identifiers, refresh and failure behavior |
| `docs/performance.md` | Named devices, test scenes, budgets, measurement procedure and results |
| `docs/tasks/` | Small task briefs with acceptance evidence and outstanding questions |

Codex reads `AGENTS.md` for project guidance and can load skills on demand. Keep the root instruction file short and link to these documents instead of embedding all research in every prompt. [Official OpenAI documentation: instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills and progressive loading](https://learn.chatgpt.com/docs/build-skills)

Suggested project invariants:

- Keep render-loop state outside React reconciliation; React owns panels and deliberate user state changes.
- Distinguish source observation time, forecast valid time, and fetch time.
- Never label inferred vehicle positions as actual live locations.
- Declare coordinate system, height reference and units at every geospatial boundary.
- Cancel obsolete viewport requests and stop inactive feed polling.
- Preserve provenance and freshness through every adapter.
- Test production builds on physical phones before claiming mobile performance.

These are proposed engineering rules, not assertions that the project already implements them.

## Skills worth reusing or adding

The current session already offers **context7-mcp**, **playwright**, and **ui-ux-pro-max** skills. Use the first for library references, the second for preview inspection, and the third as a design/accessibility review aid. Design references do not establish the best map layout; verify the chosen controls with actual place-search, floor-switching and weather interactions.

After a workflow has been repeated successfully, consider three small repository skills:

1. **HK data adapter:** inspect official schema, preserve a small licensed fixture, normalize coordinates/timestamps, validate responses, and document freshness/failure rules.
2. **Map performance review:** run fixed camera/layer scenarios, capture a trace, compare the budget and identify the dominant cost.
3. **Visual interaction review:** inspect desktop and phone layouts, keyboard/focus behavior, touch targets, reduced motion, map occlusion and empty/stale/error states.

Keep these instruction-driven, loading scripts and details only when needed. Do not install a large collection of general agent skills before discovering which repeated tasks need them.

## A practical implementation loop

1. **Define one vertical slice.** Example: search a station, fly to it, show one floor and open its next departures.
2. **Fix the contract first.** Identify inputs, normalized output, rendering boundary, fixtures and failure states.
3. **Delegate independent modules.** One agent can implement an adapter while another builds a panel against its agreed fixture. Assign separate files or worktrees. A single owner integrates scene lifecycle and shared schemas.
4. **Review a real preview.** Compare the actual screen to reference layouts. Use DOM selection for controls and explicit scene diagnostics for WebGL content.
5. **Verify meaning and behavior.** Check direction/platform joins, coordinates, dates, forecast times and failure handling alongside UI tests.
6. **Measure the production build.** Use a named camera route, stable fixtures and cold/warm cache runs. Report real-device measurements separately from desktop emulation.
7. **Record evidence and decisions.** Attach screenshots, trace paths, test results, source revision and any unresolved limitation to the task. Update only the relevant architecture document.

This loop will contribute more to a fast, coherent application than the number of installed MCP servers.
