---
phase: 1
title: "Coverage Tooling + Playwright Config Consolidation + Per-Worker Isolation"
status: completed
priority: P0
effort: "2-3d"
dependencies: []
tdd: true
---

# Phase 1 — Coverage Tooling + Test Infra Hardening

## Status (completed 2026-05-19)
- [x] `@vitest/coverage-v8@^4.1.6` installed
- [x] `package.json` scripts: `test:coverage`, `test:coverage:summary`, `test:e2e:report`, `test:e2e:shard`
- [x] `vitest.config.mjs` coverage block (v8, html/lcov/json-summary/text reporters; tightened excludes for vendor/uploads/data/scripts)
- [x] `playwright.config.js` consolidated: trace retain-on-failure, screenshot only-on-failure, video retain-on-failure, `expect.toHaveScreenshot` defaults, `mobile-chromium` project gated by env, per-RUN `runId`-based data dir
- [x] baseURL loopback guard in `tests/e2e/fixtures/test-fixtures.js` (5 API write functions)
- [x] Unit test `tests/unit/test-fixtures-loopback-baseurl-guard.test.js` (5/5 passing)
- [x] `scripts/summarize-vitest-coverage.js` → markdown digest
- [x] `.gitignore` extended (coverage/, server/data/github.json)
- [x] `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` written
- [x] Coverage baseline locked: **36.2% statements / 30.3% functions / 31.6% branches / 37.7% lines** (`reports/coverage-baseline-20260519.md`)

## Deviations from original plan
- **Per-worker globalSetup deferred** (R-03 mitigation triggered). Implementing N parallel dev/server pairs on `PORT=3202+i` adds 1-2 GB CI RAM and significant complexity. Per-RUN isolation via `runId` already prevents cross-run pollution; tests namespace state via unique presentation IDs from `apiCreatePresentation`. Phase 4 live specs already pin `workers: 1`. Documented as future work in the testing guide; revisit if shared-state flakes appear.

## Overview
Cài coverage tooling (Vitest c8 + Playwright trace) **VÀ** consolidate **toàn bộ** `playwright.config.js` edits cho plan này (per-worker data isolation, sharding setup, snapshot defaults, project matrix scaffold). Phase 6/7/9 chỉ reference, không edit. Cũng thêm baseURL loopback guard vào fixtures (security R-07). Phase này là **single source of truth** cho test infra.

## Red-team patches incorporated
- Patch-03: consolidate playwright.config.js edits (X-01)
- Patch-04: per-worker SLIDES_DATA_DIR isolation (S-01)
- Patch-05: baseURL loopback guard (S-02)

## Requirements

### Functional
- `npm run test:coverage` exits 0, sinh `coverage/index.html` + `lcov.info` + `coverage-summary.json`.
- `npm run test:e2e:report` mở Playwright HTML report.
- Markdown summary auto-generated `reports/coverage-baseline-{date}.md`.
- `playwright.config.js`: per-worker `SLIDES_DATA_DIR`, snapshot defaults, sharding setup (matrix-ready, no actual sharding here), project array prepared (chromium primary; mobile-chromium gated by env, used in Phase 7).
- `tests/e2e/fixtures/test-fixtures.js`: throw if baseURL non-loopback.

### Non-functional
- Coverage run < unit-run + 90s.
- No threshold gate (deferred to Phase 9).
- Per-worker dir cleanup automatic.

## Architecture

### Per-worker data isolation
```js
// playwright.config.js
const workerCount = process.env.CI ? 2 : 4
const baseRunRoot = path.join(__dirname, '.playwright', 'runs', runId)

// In webServer.command: launch one server per spec via PLAYWRIGHT_WORKER_INDEX
// Or use globalSetup to create per-worker dirs and pass via env per project.
```
Implementation: use Playwright's `process.env.TEST_WORKER_INDEX` inside fixtures to derive `SLIDES_DATA_DIR=${baseRunRoot}/data/w${workerIndex}` and ensure `webServer` picks per-worker dir via test setup hooks. Trade-off: simpler is single shared server with per-worker directory passed via API header — but server doesn't support that. Pragmatic: keep single shared server BUT add API namespacing via `?workerSpace=w${i}` if backend allows; else accept per-RUN isolation as P2 follow-up and document limitation.
**Decision (red-team):** implement per-worker via `globalSetup` spawning N dev servers on different ports `PORT=3202+i`, each with own dataDir. Cost: +1-2GB RAM CI, but resolves S-01 + eases F-01.

### baseURL guard
```js
// tests/e2e/fixtures/test-fixtures.js
const ALLOWED = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/
function assertLoopback(url) {
  if (!ALLOWED.test(url)) throw new Error(`baseURL not loopback: ${url}`)
}
// Call in apiCreatePresentation, apiUpdatePresentation, apiDeletePresentation, apiCreateShareLink, etc.
```

## Related Code Files
- **Modify:** `package.json`, `vitest.config.mjs`, `playwright.config.js`, `tests/e2e/fixtures/test-fixtures.js`, `.gitignore`
- **Create:** `scripts/summarize-vitest-coverage.js`, `tests/e2e/global-setup.js` (per-worker dirs), `docs/testing-guide.md`, `reports/coverage-baseline-{date}.md`

## Implementation Steps (TDD)

### Step 1 — Red
- `npm run test:coverage` → "missing script" error. Confirms tooling absent.
- Verify S-01 by running e2e + asserting different specs see same data (will be true today).

### Step 2 — Green: install + config
- `npm install -D @vitest/coverage-v8`
- Add `package.json` scripts: `test:coverage`, `test:coverage:summary`, `test:e2e:report`, `test:e2e:shard`.
- Vitest `coverage` block (provider v8, reporters, include/exclude — see prior phase for content).

### Step 3 — Green: Playwright config consolidation
- `playwright.config.js`:
  - `use.trace = 'retain-on-failure'`, `screenshot = 'only-on-failure'`, `video = 'retain-on-failure'`
  - `expect.toHaveScreenshot = { threshold: 0.2, maxDiffPixels: 100, animations: 'disabled' }`
  - `projects` array: `chromium` (Phase 0+); placeholder for `mobile-chromium` enabled by `env.PLAYWRIGHT_MOBILE_CHROMIUM` (Phase 7 will use)
  - sharding: support `--shard 1/4` etc via CLI (Playwright already supports; verify)
  - per-worker `SLIDES_DATA_DIR` via `globalSetup`

### Step 4 — Green: globalSetup per-worker
- Create `tests/e2e/global-setup.js`. Spawns dev server per worker if CI; on local can keep single server for speed (toggle via env).
- Each worker gets `${runRoot}/data/w${workerIndex}` and `${runRoot}/uploads/w${workerIndex}`.

### Step 5 — Green: baseURL loopback guard
- Add `assertLoopback` to `test-fixtures.js`. Call before every write API.
- Spec: write a unit test in `tests/fixtures-loopback-guard.test.js` verifying throw on prod URL.

### Step 6 — Green: summary script
- Write `scripts/summarize-vitest-coverage.js`: read `coverage/coverage-summary.json`, output markdown with total %, top 20 lowest files.

### Step 7 — Green: run baseline
- `npm run test:coverage` (expected ~5-7 min).
- Generate `reports/coverage-baseline-{date}.md`.

### Step 8 — Refactor
- `.gitignore`: add `coverage/`, `playwright-report/`, `test-results/`, `.playwright/runs/`, `server/data/github.json` (R-13).
- Update `docs/testing-guide.md` with new commands + per-worker isolation explanation.

## Success Criteria
- [ ] `npm run test:coverage` exits 0; `coverage/index.html` exists.
- [ ] Baseline markdown checked in `reports/`.
- [ ] Playwright fail produces `.zip` trace + screenshots.
- [ ] `.gitignore` excludes coverage + GitHub PAT.
- [ ] Per-worker `SLIDES_DATA_DIR` verified by 2 parallel specs reading isolated state.
- [ ] `assertLoopback` throws on `https://navslides.example.com`.
- [ ] All `playwright.config.js` consolidation done (no later phase touches it).

## Risk Assessment
- **R-01**: Vitest 4.x v8 coverage Node version sensitivity. Mitigation: pin Node 20+, document.
- **R-02**: Per-worker dev server adds 1-2GB RAM CI. Mitigation: keep `workers: 2` on CI; consider 4-core runner if Phase 4 needs.
- **R-03**: `globalSetup` complexity. Mitigation: prefer simplest impl first (pass dataDir via env per worker context); fallback to single-server + namespacing if globalSetup proves heavy.
- **R-04**: Initial coverage % alarmingly low for legacy untested files. Mitigation: present neutrally; drive Phase 2-8 priorities.
