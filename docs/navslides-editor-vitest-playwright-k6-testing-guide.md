# Testing Guide — NavSlides Editor (Vitest + Playwright + k6)

NavSlides Editor uses three testing layers: Vitest (unit/integration JS), Playwright (e2e), and k6 (load).

## Quick reference

| Command | Purpose |
|---|---|
| `npm test` | Vitest unit/integration suite |
| `npm run test:coverage` | Vitest with v8 coverage → `coverage/` |
| `npm run test:coverage:summary` | Markdown summary into `plans/.../reports/coverage-baseline-{date}.md` |
| `npm run test:e2e` | Playwright e2e (auto-starts dev server) |
| `npm run test:e2e:report` | Open last Playwright HTML report |
| `npm run test:e2e:shard 1/4` | Run shard 1 of 4 |
| `npm run test:audit` | Targeted ribbon audit suite |
| `npm run test:load:api` | k6 REST load test (smoke profile by default) |
| `npm run test:load:api:smoke` / `:load` / `:stress` | k6 REST with explicit profile |
| `npm run test:load:ws` | k6 Socket.IO load test (smoke profile by default) |
| `npm run test:load:ws:smoke` / `:load` / `:stress` | k6 Socket.IO with explicit profile |
| `npm run test:corpus` | PPTX import fidelity tester |
| `npm run test:deep` | Run only the `tier:deep` behavior tests (`*.deep.test.*`) |
| `npm run inventory` | Regenerate the capability inventory (`scripts/feature-inventory/inventory.json`) |
| `npm run matrix` | Regenerate the feature-coverage matrix → `docs/feature-coverage-matrix.md` (+ plan reports) |
| `npm run matrix:baseline-report` | Regenerate matrix and Phase 1 baseline gap reports |
| `npm run matrix:gate` | Regenerate matrix, then run the coverage gate + manifest-completeness drift guard |

## Feature coverage matrix (capability traceability)

A separate, capability-level signal from line coverage: it tracks whether each
editor-core capability's *behavior is asserted*, not just whether code ran. See
`docs/feature-coverage-matrix.md` for the live map.

- **What it covers**: every `ELEMENT_DEFAULTS` element type, every
  `DEFAULT_SHORTCUTS` id, and hand-maintained canvas-op / control / command /
  flow capabilities (`scripts/feature-inventory/feature-manifest.json`).
- **How a capability becomes PASS**: a test title carries a `[cap:<id>]` tag AND
  that test actually ran green (joined against vitest `--reporter=json`). A
  skipped or unrun tagged test shows `SKIP`/`TAGGED`, never PASS — no false
  green. High-risk caps need a `[cap:<id> tier:deep]` test to clear `DEEP-GAP`.
- **Drift guards**: `client/src/data/element-defaults.test.js` fails if a new
  element/shortcut has no tag or allowlist entry; `check-manifest-completeness.mjs`
  fails if a new EditorPage command is not in the manifest.
- **Allowlist**: `scripts/feature-inventory/coverage-gate-allowlist.json` holds
  dated, owned entries for acknowledged gaps (warn-first). Each entry needs a
  reason, target layer, resolution phase, and debt date so gap reports are
  actionable. It should shrink.
- **Baseline reports**: `npm run matrix:baseline-report` writes the Phase 1
  contract to `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/`.
  The JSON report is authoritative; Markdown is a review summary. The command
  refuses stale or missing run-results, so refresh
  `scripts/feature-inventory/run-results-vitest.json` with
  `npx vitest run --reporter=json --outputFile=scripts/feature-inventory/run-results-vitest.json`
  before capturing a release baseline.
- **CI**: a non-required `feature-coverage-gate` job runs `matrix:gate` + a
  freshness check on the committed `docs/feature-coverage-matrix.md`.


## Vitest coverage (v8)

`vitest.config.mjs` enables c8 via `@vitest/coverage-v8`:

- Reporters: `text`, `html`, `lcov`, `json-summary`
- Output: `coverage/` (gitignored)
- Scope: `client/src/**/*.{js,jsx}`, `server/**/*.js`, `shared/src/**/*.js`
- Excludes: tests, node_modules, dist, vendor, uploads, data, electron, pptx-import fidelity tester

Run `npm run test:coverage` then `npm run test:coverage:summary` for a markdown digest of totals + 20 lowest-covered files. The summary lands in `plans/260519-1200-comprehensive-test-coverage-expansion/reports/coverage-baseline-{YYYYMMDD}.md`.

Open the HTML report at `coverage/index.html` for line-by-line drilldown.

## Playwright e2e

`playwright.config.js` is the single source of truth for e2e infra (any further consolidation belongs here):

- `workers: 4` (local) / `2` (CI), `fullyParallel: false`
- Trace: `retain-on-failure` (CI) / `on-first-retry` (local)
- Screenshots: `only-on-failure`; videos: `retain-on-failure`
- `expect.toHaveScreenshot` defaults: `threshold 0.2`, `maxDiffPixels 100`, `animations: 'disabled'`
- Reporter: `html` + `github` annotations on CI
- Projects: `chromium` (default); `mobile-chromium` (Pixel 7) gated by `PLAYWRIGHT_MOBILE_CHROMIUM=1` (used by Phase 7)

### Per-RUN data isolation

Every `playwright test` invocation derives a unique `runId` (`{ISO timestamp}-{pid}`) and uses `.playwright/runs/{runId}/data` and `.../uploads` as the server's data root for that run. No two parallel runs share state; each is fully torn down by deleting `.playwright/runs/{runId}` on cleanup.

**Per-WORKER isolation is deferred.** The current setup gives each *run* its own data dir but workers within a run share it. Tests mitigate this by creating presentations with unique IDs via `apiCreatePresentation`, so CRUD is naturally namespaced. Workflows touching shared state (templates list, settings) should run with `workers: 1` (Phase 4 live presentation specs already do).

If parallelism causes flakes on shared state in the future, upgrade `tests/e2e/global-setup.js` to spawn one dev/server pair per worker on `PORT=3202+i`. Documented as future work — not blocking the coverage expansion plan.

### baseURL loopback guard (security R-07)

`tests/e2e/fixtures/test-fixtures.js` validates `PLAYWRIGHT_TEST_BASE_URL` matches `^https?://(127\.0\.0\.1|localhost)(:\d+)?(/|$)` before any destructive API call (`apiCreatePresentation`, `apiUpdatePresentation`, `apiDeletePresentation`, `apiCreateShareLink`, `apiCreateSnapshot`). This blocks accidental writes against shared/prod servers when env is misconfigured.

Unit-tested in `tests/unit/test-fixtures-loopback-baseurl-guard.test.js` (5 cases: 127.0.0.1 ok, localhost ok, https prod blocked, 10.x private blocked, multi-method blocked).

## Page Object Model

E2E specs use POM helpers under `tests/e2e/pages/`:

| Helper | Responsibility |
|---|---|
| `EditorPage.js` | Top-level page wrapper; delegates to specialised helpers |
| `canvas-helper.js` | Slide canvas DOM (drag, zoom, element queries) |
| `ribbon-insert-helper.js` | Insert tab (text/shape/image/table/chart) |
| `properties-panel-helper.js` | Right-side properties panel |
| `slide-panel-helper.js` | Left slide thumbnails + reorder |
| `ribbon-tab-toolbar-helper.js` | Tab switching, main toolbar buttons, overflow metrics |
| `menu-bar-dropdown-helper.js` | File / AI / Share menu dropdowns (Radix `[role=menuitem]`) |
| `text-editor-prosemirror-and-find-replace-helper.js` | TipTap editing + find/replace bar |

Helpers are kebab-case (file-naming hook); `EditorPage.js` is preserved in PascalCase because 30+ specs already import it.

## Common selectors

Post-v1.9.0 ribbon refactor uses Radix UI primitives. Prefer:

- Menu items: `getByRole('menuitem', { name: 'Foo' })` (not `.dropdown-item`)
- Menu triggers: `[aria-label="File menu"]`, `[aria-label="AI"]`, `[aria-label="Share"]`
- Tabs: `getByRole('tab', { name: 'Insert' })`
- Toolbar buttons: `getByRole('button', { name: 'Bold', exact: true })`
- Insert table cells: `getByRole('button', { name: 'Insert ${rows} by ${cols} table', exact: true }).dispatchEvent('click')` (avoids hover overlap)

Visual baselines live in `tests/e2e/visual-regression.spec.js-snapshots/`. Regenerate with `--update-snapshots` only when intentional UI changes land. Phase 6 owns Docker-based snapshotting (`mcr.microsoft.com/playwright:v1.59.1-jammy`) to eliminate platform drift.

## Visual baseline regeneration (Phase 6)

The expanded visual suite under `tests/e2e/visual/` covers 7 ribbon tabs, editor canvas states, present/speaker/share/live viewer, and a DPR-pinned mobile editor. Baselines **must** be generated inside the pinned Playwright Docker image to prevent OS-level pixel drift.

```bash
docker run --rm -v "${PWD}:/work" -w /work \
  mcr.microsoft.com/playwright:v1.59.1-jammy \
  bash -lc "npm ci && npx playwright test tests/e2e/visual/ --update-snapshots"
```

Then commit only files under `tests/e2e/visual/*-snapshots/`. Regeneration on a Windows or macOS host produces drift that the CI gate rejects.

The mobile spec uses an explicit `deviceScaleFactor: 2` (Patch-09) instead of relying on `devices['Pixel 5']` defaults, so version updates to `@playwright/test` do not silently shift the baseline.

### GitHub Actions fallback for baseline regeneration

If local Docker is unavailable, use the manual workflow on `master`:

```bash
gh workflow run manual-update-playwright-visual-baselines.yml --ref <branch>
gh run list --workflow manual-update-playwright-visual-baselines.yml --branch <branch> --limit 3
gh run download <run-id> --name linux-playwright-visual-baseline-snapshots --dir .tmp/visual-baselines
```

The workflow runs in `mcr.microsoft.com/playwright:v1.59.1-jammy`, updates and verifies both `tests/e2e/visual/` and `tests/e2e/visual-regression.spec.js`, then uploads only:

```text
tests/e2e/visual/**/*-snapshots/*.png
tests/e2e/visual-regression.spec.js-snapshots/*.png
```

The workflow is already registered on the default branch, so branch dispatch works now. The successful fallback run for the icon consistency branch was `26262072930`: update, verify, snapshot upload, and report upload all passed. Do not regenerate or commit visual snapshots from Windows/macOS hosts.

## k6 load testing (Phase 8)

Two scenarios live under `tests/load/`:

| Script | Target | Custom metrics |
|---|---|---|
| `k6-load-test-api-presentations-post-endpoint-with-profiles.js` | `POST /api/presentations` with ~1.5 MB payload | http standard |
| `k6-load-test-socketio-websocket-room-join-and-slide-change-broadcast.js` | Socket.IO presenter/viewer rooms | `room_join_success_rate`, `slide_change_messages_received` |

### Profiles

Profiles are selected via `PROFILE` env (default: `smoke`):

| Profile | VUs | Duration | Use case |
|---|---|---|---|
| `smoke` | 1 | 30s | CI sanity check; <1 min |
| `load` | 20 | 5m | Sustained typical traffic |
| `stress` | 100 | 2m | Peak / breakage discovery |

### Thresholds

REST (`http_req_duration p(95)<2000`, `http_req_failed rate<0.01`, `iteration_duration p(95)<5000`).
WebSocket (`ws_connecting p(95)<200`, `ws_msgs_received count>100`, `room_join_success_rate rate>0.99`).

Threshold breach → k6 exits non-zero → CI fails.

### Local install

- Windows: `winget install k6` (or `choco install k6`)
- macOS: `brew install k6`
- Linux: see `https://k6.io/docs/get-started/installation/`

Minimum k6 version: **0.50.0** (WebSocket v2 API).

### CI install (Patch-10)

Phase 9 wires `grafana/setup-k6-action@v1` into `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`. Pinned to `@v1` (semver-stable); bumps to `@v2` go through a dedicated PR.

## CI integration (Phase 9)

The pipeline lives in `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` and runs on PRs + pushes to `master`/`main`. A nightly soft-warning workflow `nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml` runs the 768px ribbon overflow specs without gating PRs.

| Job | Tool | Wall budget | Gate? |
|---|---|---|---|
| `lint` | eslint | 5 min | yes |
| `unit-coverage` | vitest + v8 | 15 min | yes — coverage thresholds |
| `build` | vite client build | 10 min | yes |
| `e2e-chromium` (×4 shards) | Playwright in `mcr.microsoft.com/playwright:v1.59.1-jammy` | 25 min/shard | yes — 0 fail |
| `e2e-live` | Playwright `chromium-live` (workers:1) | 20 min | yes |
| `e2e-mobile` | Playwright a11y suite on `mobile-chromium` | 15 min | yes |
| `e2e-visual` | Playwright visual suite (Linux baseline only) | 15 min | yes — snapshot drift |
| `pptx-corpus` | node corpus tester | 10 min | yes (skipped if `./PPTX` absent) |
| `load-smoke` | `grafana/setup-k6-action@v1` | 15 min | yes |
| `required-checks` | summary | < 1 min | yes — fan-in gate |

`required-checks` fans in on the currently blocking jobs and exits non-zero if any reports `failure`/`cancelled`/`timed_out`. Wire branch protection to require `required-checks` instead of every individual job — keeps the rule list small and stable when shards are renamed.

### Release-confidence lanes

Current lane ownership is documented in `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/ci-gate-verification.md`.

| Lane | Scope | Promotion rule |
|---|---|---|
| PR fast | lint, focused unit/contract checks, matrix gate signal | Keep practical for PR feedback; new gates start warn-first |
| Merge full | coverage, build, Playwright shards, visual, PPTX corpus, k6 smoke | Promote after two consecutive green CI runs |
| Release strict | PPTX strict, Electron prepare/package, load profile, manual checklist | Blocks release signoff, not every PR |

Branch protection changes are operator-only. Prefer requiring `Required checks summary`; avoid pinning every shard context unless there is a deliberate repository policy change.

Before publishing release artifacts or sharing reports, run the secret/artifact scan command in the CI gate verification report against `plans/`, `playwright-report/`, `test-results/`, `coverage/`, `dist/`, `dist-electron/`, `server/data/`, and `server/uploads/`.

Manual release smoke lives in `docs/manual-smoke-checklist.md`. Keep it under 45 minutes and map every row to a capability ID or explicit manual-only risk.

### Coverage thresholds (Phase 9 anti-regression gate)

`vitest.config.mjs` enforces baseline-derived thresholds (lines: 33, branches: 28, functions: 26, statements: 33) — set ~3 points below the 2026-05-19 measured baseline (lines: 37.7%, branches: 31.6%, functions: 30.3%, statements: 36.2%) to absorb noise from unrelated PRs that remove/add tests, while still preventing real regression. Bump these numbers via dedicated PRs as coverage rises toward the 80% aspirational target.

### Visual baselines: Linux-only via Docker (Patch-02)

All Playwright jobs run inside `mcr.microsoft.com/playwright:v1.59.1-jammy` so visual snapshots produced locally on Windows / macOS will drift. Always regenerate baselines via:

```bash
docker run --rm -v "${PWD}:/work" -w /work \
  mcr.microsoft.com/playwright:v1.59.1-jammy \
  bash -lc "npm ci && npx playwright test tests/e2e/visual/ --update-snapshots"
```

Then commit only files under `tests/e2e/visual/*-snapshots/`.

If Docker is unavailable, use the manual GitHub Actions fallback above after the workflow exists on the default branch.

### Local dev parity

```bash
npm run lint
npm run test:coverage
npm run build
npm run test:e2e          # default chromium project
npx playwright test --project=chromium-live
npx playwright test --project=mobile-chromium  # requires PLAYWRIGHT_MOBILE_CHROMIUM=1
npm run test:load:api:smoke
npm run test:load:ws:smoke
```

These commands map 1:1 to CI jobs so red builds are reproducible.
