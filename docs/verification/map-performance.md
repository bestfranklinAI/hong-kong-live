# Map performance pass — 13 September 2026

## Changes

`BasemapLayers` reconciles stable layer identities. Switching English/Traditional Chinese replaces only the label layer, preserving the background's loaded resources and the neutral base. Map-style changes release replaced resources and detach their error listeners. No hidden style cache is retained. Existing errors on unchanged layers remain visible.

Globe tile-cache retention targets are now Eco 128, Standard 256 and High 384 (previously Cesium's default 100). These count terrain/globe tiles, not individual PNGs or bytes, and current visible tiles can exceed the target. The optional 3D Tiles cache is a separate setting. No prefetch expansion, offline store, shared proxy or change to provider HTTP cache policy was introduced.

Rendering resolution, screen-space detail, MSAA and flight duration are unchanged. The sample did not justify sacrificing clarity: the observed delay was chiefly tiles arriving, while the selected-place camera flight was smooth. A separate physical-device benchmark can reach a different conclusion.

## Measurement method and limitations

Local production Vite build, opt-in `VITE_SCENE_DIAGNOSTICS=true`, Codex in-app Chromium at 1280×720; renderer canvas 1246×622, Standard quality, LandsD Map. No CPU/network throttling. Browser cache was **not cleared**. Baseline and changed runs were sequential against public tiles, so download timings are mixed-cache observations, not a controlled cold-load comparison or proof of a speedup ratio.

Journey: harbour start → Victoria Peak → English-to-Chinese labels → reset to harbour → close/reselect Peak. Samples were read after the scene became idle. No load test, bulk download or repeated cache purge was used.

`ScenePerformance` measures actual `postRender` frame intervals between camera movement events, tile-queue loading episodes, imagery layer additions/removals and browser resource completions. It publishes one DOM snapshot per second with bounded sample buffers and no per-frame React updates. All listeners/observers/timers are disposed. It is build-time opt-in and absent from the normal application flow.

Frame intervals are not GPU execution time or INP. A tile queue becoming empty does not establish a scientifically defined useful-scene metric. Resource completions include browser cache hits; cross-origin transfer-size zeros cannot establish a disk-cache hit without the required Timing-Allow-Origin information. The resource-duration percentile is cumulative (bounded to the latest 1000 entries), not the duration of the most recent interaction.

## Baseline observations

- Initial queue first settled 379 ms after scene instrumentation started (not after navigation).
- First Peak flight: frame median 10.0 ms, p95 11.2 ms, no measured intervals over 33 ms; final loading episode 4398 ms.
- Language switch: 3 layers destroyed and 3 created; background resource completions rose 83 → 128 (45 extra background loads), labels 83 → 128.
- Reset to harbour: p95 11.2 ms, final loading episode 2170 ms.
- Warm Peak revisit: p95 11.3 ms, final loading episode 90 ms. Browser/engine caching already helped substantially before this change.
- Settled idle samples reported zero draws between one-second samples.

## Changed-build observations

- Initial queue first settled 349 ms; same 1246×622 canvas and Standard quality.
- Peak flight: frame median 10.0 ms, p95 11.3 ms, no measured intervals over 33 ms; final loading episode 278 ms. The browser was warmer than in the baseline, so this is not attributed solely to the code change.

- Language switch: only 1 layer removed/added; background completions stayed **89 → 89**, while labels rose 89 → 134. This directly verifies elimination of unnecessary background resource loads.
- Harbour reset: p95 12.4 ms with 2 intervals over 33 ms; final loading episode 20 ms. Background completions rose by 7, compared with 44 in the baseline reset, but traversal timing and cache history were not controlled.

- Warm Peak revisit: p95 11.5 ms, no intervals over 33 ms, final loading episode 19 ms; background and label resource counts did not increase (96/185 before and after). Idle again reported zero draws per sampled second.
- Normal production build, TypeScript, ESLint, formatting and all 49 tests passed. Instrumentation is omitted from the normal JavaScript build.

## Reproduce locally

```sh
VITE_SCENE_DIAGNOSTICS=true pnpm --filter @hk/web exec vite build --outDir ../../output/perf
pnpm --filter @hk/web exec vite preview --host 127.0.0.1 --port 4174 --strictPort --outDir ../../output/perf
```

Open port 4174, expand “Local render diagnostics”, and run the same UI journey. Ensure the tab is visible. Record quality, viewport, tile pending count and browser/network conditions with every comparison. Run `pnpm build` for the normal build without the flag.

## Remaining gates

Physical Android frame times, high-DPI memory/thermal stability and real cold/warm network tests remain unmeasured. No promise of instant revisits or reloads is made: browser cache eviction, new zoom levels, image decoding and GPU texture preparation still matter. Four regression tests cover retained layer identity, no-op updates, error/listener ownership and disposal. The complete suite now contains 49 passing tests.
