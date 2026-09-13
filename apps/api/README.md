# HK Live API

The first slice exposes a named reference weather station and selected MTR departures. Provider parsing belongs in `packages/providers`, shared runtime contracts in `packages/contracts`, and request/caching behaviour here.

## Run locally

From the workspace root after dependency installation:

```sh
pnpm --filter @hk/api dev
```

The Node adapter listens on `127.0.0.1:8787`. The web development server proxies `/api` to it. `src/app.ts` exports a Hono fetch handler without Node globals; `src/server.ts` owns the local adapter. Nothing is deployed or billed by this command.

```sh
HK_DATA_MODE=fixture pnpm --filter @hk/api dev
```

Fixture mode is explicit in `mode`, `X-HK-Data-Mode`, and the server log. Recorded fixture timestamps remain unchanged and eventually expire; deterministic tests inject a clock. Live failures never substitute a fixture.

## Routes

| Route                                   | Behaviour                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `/api/v1/health`                        | Process health and data mode, not upstream service health                 |
| `/api/v1/weather/current`               | HKO temperature/humidity at Hong Kong Observatory plus HKO condition icon |
| `/api/v1/arrivals?line=ISL&station=ADM` | Estimated train times from the selected MTR line/station                  |

Initial validated coverage: ISL ADM/CEN/WAC, TWL ADM/CEN/TST, TCL HOK. Other combinations return 400 before any upstream request. This limit also bounds the number of local cache entries. Departures from both directions retain their platform, destination and unique ID; no train positions are inferred. A successful empty schedule differs from a source failure, which returns an unavailable feed.

Feeds contain `data`, `provider`, `sourceUrl`, successful `fetchedAt`, nullable `sourceUpdatedAt`, `status`, optional `error`, and `mode`. All emitted timestamps are UTC ISO strings; the interface displays HKT. HKO's oldest displayed component time is the summary time, so newer report publication never hides older observations. The current route is an observation summary, **not** a comprehensive weather-warning feed.

## Freshness and failure policy

| Feed            | Refresh on request after | Fresh source age | Stop serving after last successful fetch | Stop serving after source time |
| --------------- | ------------------------ | ---------------- | ---------------------------------------- | ------------------------------ |
| Current weather | 60 seconds               | 45 minutes       | 15 minutes                               | 2 hours                        |
| MTR             | 30 seconds               | 30 seconds       | 90 seconds                               | 90 seconds                     |

These are application policies, not claimed provider rate limits. MTR publishes every 10 seconds; the UI deliberately polls less often in this first slice. Cache age and source age are separate checks. Unknown source time is stale; timestamps more than two minutes in the future are unavailable. An out-of-order response does not overwrite newer source data. Source failure preserves last-good data only within its original expiry, and applies a local retry cooldown of at least five seconds, extended by a source `Retry-After` response when present. Requests use a six-second timeout and a 256 KiB response limit enforced while reading the body. HTTP responses are `no-store`; browser Query polling must remain explicitly configured and paused when hidden.

`FeedCache` coalesces concurrent requests only within one process/isolate. It has **no globally coordinated cache**, durable storage, provider-wide quota enforcement, or retry scheduler. Before public deployment, introduce the planned per-feed Durable Object coordination, provider quota/backoff controls, deployment bindings, and operational limits. R2 is not needed for these small live JSON responses. The current local API requires no Cloudflare account.

## Verification

```sh
pnpm exec vitest run apps/api/src packages/providers/src
pnpm typecheck
```

Tests cover real recorded schema normalization, missing measurements, source/service failures, UTC/HKT boundaries, explicit station coverage, singleflight concurrency, expiry, older updates, and fixture isolation. Live smoke checks should remain separate from deterministic tests and never load-test public providers.

Implementation references: [Hono Node adapter](https://hono.dev/docs/getting-started/nodejs), [Hono Workers adapter](https://hono.dev/docs/getting-started/cloudflare-workers), [HKO API](https://data.weather.gov.hk/weatherAPI/doc/HKO_Open_Data_API_Documentation.pdf), [MTR dataset and dictionary](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data).
