---
title: "Red Team Report — Test Coverage Expansion"
date: 2026-05-19
plan: 260519-1200-comprehensive-test-coverage-expansion
plan_head: 51b83408
reviewer: code-reviewer (red-team mode, 4 roles)
---

# Red Team Report — Test Coverage Expansion (NavSlides Editor)

> Adversarial review of plan v1 against HEAD `51b83408`. Brutal, ranked, evidence-cited.

## Executive Summary

- **Verdict: PROCEED-WITH-CHANGES** (1 blocker, 4 high, several mediums; effort under-estimated 30-50%).
- Top 5 findings (severity-ranked):
  1. **C-01 (blocker)** — CI 25-min budget unreachable: e2e-chromium 16m on dev `workers=4`, CI runs `workers=2` → realistic ≥ 28-32m; GitHub queue/cache time not in budget.
  2. **S-01 (high)** — `SLIDES_DATA_DIR` is **per-RUN, not per-worker** (`playwright.config.js:7-13`). With `workers=4` (`:21`), 4 specs share same data dir → cross-test pollution; analytics view counters & share tokens leak between tests. Documented as "already isolated" but isn't.
  3. **P-01 (high)** — Phase 2 effort (5-7d) under-counts: Chart 6 types + Game 7 types + property-panel exercise (3-5 controls each) for 16 element categories ≈ 9-12d realistic.
  4. **F-01 (high)** — Phase 4 annotation-sync 4-page test with `<500ms` poll + `expect.poll(5s)` for canvas DOM strokes will be top-3 flakiest spec on CI; mitigation "retry once" insufficient.
  5. **S-02 (high)** — Plan never asserts `apiUpdatePresentation` baseURL is loopback. `PLAYWRIGHT_TEST_BASE_URL` env wins (`playwright.config.js:5`) → mis-set CI secret can wipe production data with **zero auth** (write endpoint has no auth — verified `server/index.js:102` + `server/routes/presentations.js`).
- **Effort recalibration:** 3-4 weeks single-dev → realistic **5-6 weeks**; 1.5 weeks 3-agent parallel → **2.5-3 weeks** (Phase 9 is hard serial dependency on every Phase).

---

## Findings by Role

### 1. The Pessimist (timeline scrutiny)

**P-01 (high) — Phase 2 effort 5-7d under-counts ~40%.** `phase-02-element-types-e2e-coverage.md:11-31` lists 16 element categories incl. Chart 6 types + Game 7 types + property panel "3-5 top controls per type". Realistic: 11 spec files × 0.5-0.7d/file + property-panel helper plumbing 1-2d = **9-12d**. Compare with similar Vitest-driven coverage push (146 files / 1239 tests took ~6 weeks across previous releases per git log).

**P-02 (high) — Phase 0 effort 2-3d optimistic on EditorPage POM split.** `EditorPage.js` is 565 LOC (`research/researcher-01:107`) with multi-spec dependents. Splitting into `RibbonHelper.js` + `MenuBarHelper.js` + slimmed `EditorPage.js` while preserving "public POM API backward-compatible" (`phase-00:42`) requires regression check across 32 specs. Realistic 4-5d if any spec uses non-public method via destructuring.

**P-03 (high) — Phase 4 (3-4d) under-counts socket multi-page race work.** Bootstrap of `presenter+viewer+speaker+remote` = 4 contexts × `window.name` token wiring + 5 specs (annotation, B/W, timer, keyboard, end). Historical flaky annotation-sync alone has consumed ~2d in v1.8 timeline. Realistic 5-7d.

**P-04 (medium) — "1.5 weeks 3-agent parallel" misleading.** Phase 9 depends on 0+1+2+3+4+5+6+7+8 (`phase-09 frontmatter`). Phases 1, 6, 9 all touch `playwright.config.js` (`overview:89`) — sequential serialization required. Realistic: even with 3 agents Lane A blocks on 0 → 1 → 6 → 9 chain ≈ 2.5-3 weeks.

**P-05 (medium) — Phase 0 cross-plan blocker on `260518-2245`.** Overview line 10 marks `blockedBy`. That plan has 6 phases × ~7-10h = 1.5-2d but Phase 03 (header CTA wrap) blocks Phase 05 — so 2245 itself realistic 3-4d. Add slip risk → Phase 0 of THIS plan starts day 4-5, not day 1.

**P-06 (medium) — No padding for visual baseline regen review (`Phase 0 Step 7`).** Manual review of 25+ snapshots is 1-2h per loop; baseline regenerated AFTER A-I clean → if any spec lands a UI tweak in Phase 2/5, baseline invalidated → loop repeats. Plan has no buffer for ≥ 2 baseline regens.

**P-07 (medium) — Coverage threshold 80% may be unreachable Q1 (R-04 noted but no mitigation locked).** `editor-store`, `presentation-store`, `ui-store` currently 0% (researcher-01:84). Driving them to 80% in Phase 2 (which doesn't own stores) requires Phase 9 to either reduce threshold OR add a Phase 1.5 "store unit tests" lane absent from plan.

---

### 2. The Security Reviewer

**S-01 (high) — Per-RUN data dir, not per-worker.** `playwright.config.js:7-13` builds **one** `runRoot` per process; `webServer.env.SLIDES_DATA_DIR` set once. Workers=4 (`:21`) → 4 parallel specs share same `data.json` + `share-tokens.json` + `analytics.json`. Tests for Phase 5 (analytics counter increments, share token revoke) will see counter pollution from sibling-worker tests. Mitigate with per-worker `process.env.TEST_WORKER_INDEX` injection in `webServer.env`, or set `fullyParallel: true` + per-worker `webServer` (heavier).

**S-02 (high) — `apiUpdatePresentation` has no auth + baseURL trusted from env.** Verified `server/routes/presentations.js` PUT — no auth middleware. `playwright.config.js:5` accepts `PLAYWRIGHT_TEST_BASE_URL`. If CI mis-sets that env to a real prod URL (copy-paste from secrets) tests will silently overwrite real presentations. **Phase 9 MUST** add a guard: `if (!baseURL.match(/^https?:\/\/(127\.0\.0\.1|localhost)/)) throw`.

**S-03 (medium) — Analytics token in query string leaks.** `server/routes/analytics.js:28` reads `req.query.token`. URL with token persists in: browser history, server access logs, Referer header on outbound links, proxy/CDN logs. Phase 5 should test that token is hashed/HMAC'd in URL OR pass via header. As written, plan tests only check 403 paths, not the leak.

**S-04 (medium) — Share rate limit too coarse + couples views with verify.** `server/index.js:83-88` mounts `shareLimiter` (10 req / 5 min) on **`/share/` prefix** → covers GET landing + POST verify with same bucket. Legitimate viewer hitting refresh 11× during a 5-min talk gets 429. Phase 5 spec should explicitly test this edge — currently only 401/200 paths planned.

**S-05 (medium) — Phase 5 missing presenter-token replay test.** `phase-05:46` mentions "expired (manipulate via direct DB / API), wrong room" — but nothing about token reuse after presenter ends room (replay window). Live socket join may accept stale token if `live-rooms.js` doesn't invalidate on `end-presentation`. Add: post-end token reuse → must reject.

**S-06 (low) — bcrypt cost 10 OK; verified `share.js:73` (`bcrypt.hash(password, 10)`) and `index.js:197` (`bcrypt.compare`) — async constant-time.** Acceptable. Phase 5 should add unit test verifying password is **never returned in JSON** (currently filtered at `share.js:31` + `:87`, easy to regress).

**S-07 (low) — GitHub PAT in fixture risk.** Phase 3 `.navslides` archive roundtrip + Phase 5 share fixture must not commit any test PAT. Plan doesn't list `.gitignore` rule for `server/data/github.json` (verify if exists). If fixture seeds GitHub config, sanitize before snapshot.

---

### 3. The Flaky-Test Exorcist

**F-01 (high) — Phase 4 annotation-sync 4-page socket race.** `phase-04:18` requires "presenter → viewer in <500ms (poll-based assertion)". On `ubuntu-latest` 2 vCPU with 4 page contexts + Socket.IO heartbeat + chromium GC = 200-1000ms tail. Threshold too tight. Pattern: replace `<500ms` hard assert with "eventually consistent within 5s, last sample <2s". Use `expect.poll(() => count, { timeout: 5_000, intervals: [100, 200, 500] })`.

**F-02 (high) — Phase 4 live-timer "≥1s elapsed within 2s" tight on CI.** `phase-04:54` "verify all 3 views show ≥1s elapsed within 2s". CI clock + setInterval skew + 3 views polling = 1-3s tail. Use ≥0.5s within 5s window or assert monotonic increase.

**F-03 (high) — Phase 6 visual specs OS-specific antialiasing.** `phase-06 R-01` proposes Docker baseline. Plan does NOT lock CI to Docker — `phase-09:26` says `ubuntu-latest`, no Docker step. Native ubuntu-latest font renderer differs from Docker `mcr.microsoft.com/playwright`. Result: dev regenerates baseline on Linux Docker, CI runs naked ubuntu-latest → false positive on every PR. **Lock CI to `container: mcr.microsoft.com/playwright:v1.x-jammy`.**

**F-04 (high) — Phase 2 TikZJax 5s poll insufficient.** `phase-02 R-02` "expect.poll with 5s timeout". TikZJax WASM cold compile is 3-15s on first slide. First spec in shard hits cold path → flaky. Use 30s timeout for first TikZ render, 5s subsequent. Pre-warm via `page.goto` of fixture page that loads TikZJax before spec under test.

**F-05 (medium) — Phase 7 axe-core dynamic content.** Plan `phase-07:67` "filter specific rules via `disableRules`" — vague. axe will hit transient violations during Joyride tour render, modal mount transitions, ribbon dropdown open. Required: `axe.run(page, { rules: { 'color-contrast': { enabled: true } }, exclude: ['[data-axe-skip]'] })` AND `await page.waitForFunction(() => !document.querySelector('[data-state="open"][data-radix-popper]'))` before each scan.

**F-06 (medium) — Phase 6 mobile viewport snapshot at 390x844.** Mobile chromium has different DPR (2 or 3) than desktop. Snapshot at one DPR fails on another runner. Pin DPR via `viewport: { width: 390, height: 844 }, deviceScaleFactor: 2`.

**F-07 (medium) — Phase 3 PDF export raster non-determinism.** PDF assertion "page count = ∑(slides × fragment_stages)" — but reveal.js print may collapse fragments differently per chrome version. Phase 3 should pin chromium version OR assert `>= slides` not `== slides × fragments`.

**F-08 (low) — Phase 2 KaTeX render — 5s OK** (KaTeX is pure JS, sync after script load). Keep.

---

### 4. The CI Cost Analyst

**C-01 (blocker) — CI total time budget broken.** Plan `phase-09:26` "<25min on ubuntu-latest". Reality:
- e2e-chromium estimated 16m (`phase-09:33`) is dev-baseline `workers=4` (`playwright.config.js:21`). CI uses `workers=2` (same line, ternary) → ~30m wall.
- Adding Phase 2 (~50 new specs), Phase 3 (~15), Phase 4 (~12), Phase 5 (~10), Phase 7 (~12), Phase 6 visual (~25 snapshot tests) → +100-130 specs over current 246 → e2e wall +50% → **CI wall 35-45min** before queue/cache. Budget needs realistic recalibration to **<45min** OR shard chromium across 2-4 jobs.

**C-02 (high) — `ubuntu-latest` 2 vCPU 7GB RAM OOM risk on Phase 4 multi-page.** Phase 4 specs spawn 4 BrowserContexts (presenter+viewer+speaker+remote) **per test**. With `workers=2` → 8 chromium contexts simultaneously. Each ~250-500MB headless → 2-4GB peak just for browsers, + Node, + dev server. **Will OOM on ubuntu-latest.** Either: (a) reduce Phase 4 to `workers=1` for that suite, (b) larger runner (`ubuntu-latest-4-cores`), (c) shard.

**C-03 (high) — Playwright browser cache miss = +3min cold.** Cache key not specified in `phase-09:27` ("cache `node_modules` + Playwright browsers"). Without `~/.cache/ms-playwright/` keyed to `playwright/test` version → cache invalidates on every patch bump. Add `key: playwright-${{ hashFiles('package-lock.json') }}-${{ runner.os }}`.

**C-04 (high) — GitHub Actions queue time 5-15min not in budget.** No mitigation in plan. Org-runners or GitHub-hosted runners on free tier hit queue spikes. Phase 9 success criterion "<25 min" measures runtime not wall. Either change criterion to "runtime <25min" OR document expected p95 wall.

**C-05 (medium) — Visual regression `e2e-visual` 3m too optimistic.** 25 snapshots × dev server cold start (~10s) + chromium boot (~5s/test) + screenshot capture (~1s/snap) ≈ 4-6min. Add buffer.

**C-06 (medium) — `marocchino/sticky-pull-request-comment@v2` permissions.** `phase-09 R-03` notes "pull-requests: write" — also need `issues: write` for sticky comments on issues, and `permissions:` block on workflow level if repo default is restrictive. Forks PRs cannot post comments without `pull_request_target` (which has its own security risks).

**C-07 (medium) — Coverage upload artifact size.** lcov.info ~5MB; `coverage/index.html` recursive ~50-200MB (one HTML per file × 700+ source files). Upload at every PR → 30-day retention × 100 PRs = ~5-20GB org storage. Mitigate: upload only `lcov.info` + `coverage-summary.json`; skip HTML.

**C-08 (low) — k6 v0.50 install on Actions.** `phase-08 R-02` says "pin via setup script". Use `grafana/setup-k6-action@v1` not raw apt-get (apt has stale 0.42).

---

## Cross-cutting Findings

**X-01 (high) — Same `playwright.config.js` touched by Phase 1, 6, 7, 9.** Even with parallel lanes (`overview:84`), 4 phases sequentially edit one config file. Risk: merge conflicts + race when 3 agents Lane A/B/C all push within day. Mitigation: lock config edits to Phase 1 (set scaffolding for all later phases up-front). Plan currently doesn't.

**X-02 (high) — Per-worker data isolation (S-01) + 4-page race (F-01) + OOM (C-02) compound.** Phase 4 + Phase 5 + Phase 9 stack same root cause: state-isolation per worker is undefined. Single fix: per-worker `webServer` + `SLIDES_DATA_DIR=…/${TEST_WORKER_INDEX}` resolves S-01, eases F-01 (no cross-worker noise), constrains C-02 (one-worker mode for live specs).

**X-03 (medium) — Phase 0 + Cross-plan dep + Phase 9 chain.** `260518-2245` slips → Phase 0 slips → Phase 2-7 slip → Phase 9 slips → release v1.10 slips. No buffer in plan timeline. R-06 in overview only says "fixme + ticket" but doesn't recalibrate dates.

---

## Recommended Plan Patches (no implementation)

**Patch-01 (Phase 9):** Recalibrate CI budget `<25min` → `<45min wall, <30min runtime`. Add 4-shard Playwright matrix to keep e2e-chromium per-shard <12min:
```
strategy:
  matrix:
    shard: [1/4, 2/4, 3/4, 4/4]
```

**Patch-02 (Phase 9):** Lock CI to Playwright Docker container. Add `container: mcr.microsoft.com/playwright:v1.x-jammy`. Closes F-03.

**Patch-03 (Phase 1 — pulled forward from Phase 9):** Consolidate ALL `playwright.config.js` edits in Phase 1 (projects, traces, snapshot defaults, sharding setup, per-worker webServer). Phase 6/7/9 only reference. Closes X-01.

**Patch-04 (Phase 1):** Implement per-worker isolation. Replace `playwright.config.js:7-13` runRoot with per-worker dir keyed off `TEST_WORKER_INDEX`. Closes S-01, eases F-01.

**Patch-05 (Phase 9 / fixtures):** Add baseURL guard to `apiUpdatePresentation` and other write helpers in `tests/e2e/fixtures/test-fixtures.js`. Throw if not loopback. Closes S-02.

**Patch-06 (Phase 2):** Re-estimate 5-7d → **8-11d**. Split into Phase 2a (P1 element types: math, divider, image-crop, shapes, code, markdown, html-embed) and Phase 2b (charts, video/audio/table, qr/icon/callout/drawing, games). Allows Phase 2a to unblock Phase 6 visual baseline earlier.

**Patch-07 (Phase 4):** Re-estimate 3-4d → **5-7d**. Replace tight `<500ms` and "within 2s" thresholds with tolerant polls (5s window, last-sample-<2s). Pin Phase 4 to `workers: 1`. Closes F-01, F-02, C-02.

**Patch-08 (Phase 5):** Add 3 explicit specs:
- (a) password not returned in any JSON response (regression guard for `share.js:31, :87`),
- (b) presenter token rejected after `end-presentation` (S-05),
- (c) analytics token in URL leak warning (S-03 — at minimum, document the leak; ideally migrate to header).

**Patch-09 (Phase 6):** Drop Mobile snapshot (1 of 25) from initial baseline OR pin DPR. Closes F-06.

**Patch-10 (Phase 8):** Add explicit k6 install via `grafana/setup-k6-action@v1`. Skip apt.

**Patch-11 (overview):** Recalibrate top-line effort 3-4 weeks → **5-6 weeks single dev**. Update `target_release` if v1.10.0 deadline tight.

**Patch-12 (Phase 7):** Add explicit axe wait-for-stable-DOM helper in plan, not deferred to "filter rules". Closes F-05.

---

## Open questions cần user đóng trước cook

1. CI runner: confirm `ubuntu-latest` (free tier, 2 vCPU 7GB) vs `ubuntu-latest-4-cores` (paid). Phase 4 likely needs 4-core.
2. Visual baseline OS strategy: lock CI Docker container, or commit per-OS snapshots?
3. Coverage HTML report — keep upload at 50-200MB/run, or lcov-only?
4. Time budget for v1.10 release — does effort recalibration to 5-6 weeks slip target_release date?
5. Phase 5 — confirm whether analytics token leak via query param is acceptable (current behavior) or needs migration.
6. Phase 4 multi-page — accept `workers: 1` for that suite (longer wall, fewer flakes)?
7. Per-worker data isolation: implement now (X-02 fix touches Phase 1 + Phase 9) or defer?

---

## Sign-off

- **Pessimist:** PROCEED-WITH-CHANGES — effort under-estimated; recalibrate ≥ 1.5×.
- **Security Reviewer:** PROCEED-WITH-CHANGES — S-01 worker isolation + S-02 baseURL guard MUST land before Phase 5/9.
- **Flaky-Test Exorcist:** PROCEED-WITH-CHANGES — F-01, F-03 will burn CI flake budget without explicit mitigations.
- **CI Cost Analyst:** REVISE-FIRST — C-01 budget needs explicit shard plan; otherwise plan ships an unreachable success criterion.

**Final verdict: PROCEED-WITH-CHANGES** — apply Patches 01-05 + 07 before cook; remaining patches as in-flight refinements.
