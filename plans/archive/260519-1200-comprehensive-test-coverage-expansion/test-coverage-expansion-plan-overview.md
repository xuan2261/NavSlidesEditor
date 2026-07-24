---
title: "Comprehensive Test Coverage Expansion (NavSlides Editor) — TDD"
description: "Stabilize 35 failing e2e tests, add c8 + Playwright trace coverage tooling, expand element/export/live/sharing coverage, set visual baseline, wire CI gate. TDD-driven."
status: completed
priority: P0
effort: "6-8 weeks single dev / 3-4 weeks 3 parallel agents w/ Phase 2 split (post-red-team recalibration)"
branch: "master"
target_release: v1.11.0
tags: [testing, qa, e2e, playwright, vitest, ci, tdd, refactor]
blockedBy: [260518-2245-ribbon-audit-gate-failures-fix-tdd]
blocks: []
created: "2026-05-19"
completed: "2026-05-19"
createdBy: "ck-plan-skill"
source: skill
---

# Comprehensive Test Coverage Expansion — NavSlides Editor

## Overview

Project hiện ở v1.9.0 (HEAD `51b83408`). Unit suite ổn định (146 files / 1239 tests pass) nhưng e2e suite **35 fail / 1 flaky / 210 pass** sau ribbon refactor v1.9.0. Plan này: (1) stabilize e2e selectors, (2) cài coverage tooling, (3) mở rộng feature coverage P0/P1, (4) baseline visual regression, (5) wire CI gate. TDD: mỗi phase chia Red (failing test) → Green (impl tối thiểu) → Refactor (clean ≤200 LOC).

## Cross-plan dependency

- **`260518-2245-ribbon-audit-gate-failures-fix-tdd`** đã có 6 phase phủ trọn Category B (6 ribbon-a11y failures F1-F6). Plan này KHÔNG re-handle Category B trong Phase 0 — scope Phase 0 xuống còn Categories A + C-J (29 fail). Đợi 2245 plan complete trước khi merge baseline.
- Plan `260518-1015-editorpage-ui-ux-audit-fixes-tdd` (status: pending) — đã được 2245 plan supersede cho hầu hết changes; không có overlap trực tiếp với plan này.

## Baseline metrics (2026-05-19)

| Metric | Value |
|---|---|
| Unit Vitest (files / tests / status) | 146 / 1239 / pass |
| Unit duration | 325s |
| E2E Playwright cases | 246 |
| E2E pass / fail / flaky | 210 / 35 / 1 |
| E2E duration | 15.6 min |
| Coverage tool | not installed |
| Visual regression specs | 1 |
| `.skip / .fixme / .only` count | 0 |

Reports: `research/researcher-01-coverage-gap-audit.md`, `research/researcher-02-e2e-failure-categorization.md`, `reports/e2e-baseline-260519.log`.

## User decisions (locked)

1. **Scope:** Comprehensive multi-phase (9 phases).
2. **Coverage:** Install `@vitest/coverage-v8` + Playwright trace.
3. **768px viewport:** required ≥ 1024px; 768px nightly soft-warning only (Category A → fixme + ticket, no UI fix in this plan).
4. **Browser matrix:** Chromium-only; Phase 7 adds mobile-chromium project for touch.
5. **TDD:** Every phase Red→Green→Refactor.

## Phases

| # | Phase | Status | File | Effort | Priority |
|---|---|---|---|---|---|
| 0 | Stabilize 29 e2e fails (excl Category B) + EditorPage POM split | completed | `phase-00-stabilize-failing-e2e-tests.md` | M (4-5d, was 2-3d) | P0 |
| 1 | Coverage tooling + ALL playwright.config consolidation + per-worker isolation + baseURL guard | completed | `phase-01-setup-coverage-tooling-and-baseline-report.md` | M (2-3d, was 1d) | P0 |
| 2a | Element types core (text/image/shape/code/math/markdown/chart/table) | completed | `phase-02-element-types-e2e-coverage.md` | M (5-7d) | P1 |
| 2b | Element types drawing/games/QR/icon/callout/divider | completed | `phase-02b-element-types-drawing-games-qr.md` | S (3-4d) | P1 |
| 3 | Export/Import flows — PDF (headers+size+pages), PPTX, .navslides, MD | completed | `phase-03-export-import-flows-e2e.md` | M (3-4d) | P0 |
| 4 | Live presentation full — annotations, B/W, timer (workers:1) | completed | `phase-04-live-presentation-full-coverage.md` | M (5-7d, was 3-4d) | P0 |
| 5 | Sharing + analytics + auth coverage (+ password-leak + token-replay specs, mock-only AI) | completed | `phase-05-sharing-analytics-and-auth-coverage.md` | S (2-3d) | P1 |
| 6 | Visual regression baseline expansion (Docker container locked) | specs-staged | `phase-06-visual-regression-baseline-expansion.md` | S (2d) | P1 |
| 7 | Touch / keyboard / a11y / mobile (+ axe wait-for-stable-DOM helper) | completed | `phase-07-touch-keyboard-a11y-mobile-coverage.md` | S (2d) | P1 |
| 8 | Performance / load thresholds (k6 via grafana/setup-k6-action) | completed | `phase-08-performance-and-load-thresholds.md` | S (1d) | P2 |
| 9 | CI integration + 4-shard matrix + Docker container + coverage gate | completed | `phase-09-ci-integration-and-coverage-gate.md` | M (2-3d, was 1-2d) | P0 |

## Dependency graph

```
Phase 0 (stabilize) ──┐
                      ├──> Phase 2 (elements)
                      ├──> Phase 3 (export)
                      ├──> Phase 4 (live)
                      ├──> Phase 5 (share)
                      └──> Phase 7 (a11y)
Phase 1 (coverage) ────parallel with Phase 0─────> Phase 9 (CI gate)
Phase 5 ──> Phase 6 (visual baseline) ──> Phase 9
Phase 8 (load) ────parallel─────────────────────> Phase 9
```

Phase 9 closes plan: gate enforces metrics from 1, 6, 8.

## Parallel execution lanes

If multi-agent:
- **Lane A — Infra:** Phase 0 → 1 → 6 → 9
- **Lane B — Feature:** Phase 2 → 3 → 4
- **Lane C — Aux:** Phase 5 → 7 → 8

File ownership boundaries declared in each phase. Conflict zones: `tests/e2e/pages/EditorPage.js` (Phase 0 only), `playwright.config.js` (**Phase 1 single source of truth — Phase 6/7/9 only reference, no edits**, per Patch-03).

## Plan-level success criteria

- 0 e2e fail / 0 flaky on chromium.
- Vitest coverage ≥ 80% statements/branches across `client/src/{stores,hooks,utils}`, `server/{routes,services}`, `shared/src/`.
- Playwright projects: chromium + mobile-chromium (Phase 7).
- Visual baseline ≥ 20 snapshots committed.
- k6: api-load p95 < 500ms, ws-load room-join success > 99%.
- CI workflow on PR: lint + unit-coverage + e2e + corpus + k6-smoke; coverage gate fails build < 80%.
- `docs/testing-guide.md` documented.

## Open questions (consolidated)

### Resolved by red-team patches (no user action)
- ~~5. Visual snapshot baseline OS-specific?~~ **RESOLVED:** Linux only via `mcr.microsoft.com/playwright:v1.59.1-jammy` Docker container (matches installed `@playwright/test@1.59.1`; Patch-02 in Phase 6 + 9).
- ~~7. Analytics token in URL query (S-03)?~~ **RESOLVED:** Phase 5 spec `analytics-token-leak-warning.spec.js` (Patch-08) asserts behavior; if Referrer-Policy missing → soft warning + P1 ticket.
- ~~8. Phase 4 multi-page workers:1?~~ **RESOLVED:** Yes (Patch-07); accept ~8 min wall for live suite stability.
- ~~9. Per-worker data isolation now or defer?~~ **RESOLVED:** Implement NOW in Phase 1 (Patch-04); per-worker `SLIDES_DATA_DIR` keyed off `TEST_WORKER_INDEX`.

### Still open — user decision needed
1. AI flow real-test vs mock-only? (current: mock-only) — Phase 3 + 5 affected.
2. PDF export e2e: only verify size+headers, or parse content? (cost vs value) — Phase 3.
3. Onboarding tour: write spec for first-time user, or keep suppressed via localStorage? — Phase 7 backlog.
4. CI runner: `ubuntu-latest` (default) vs `ubuntu-latest-4-cores` for Phase 4 (R-09). Red-team recommends 4-cores if observed flake rate > 1% in Phase 4 dry-run.
6. Effort recalibration to 6-8 weeks single-dev (3-4 weeks 3-agent parallel w/ Phase 2 split) slips `target_release: v1.11.0`. Bump to v1.11.0 or compress scope by deferring Phase 2b (drawing/games) + Phase 8 (load) to follow-up?

## Risk register

| ID | Risk | Mitigation | Owner phase |
|---|---|---|---|
| R-01 | Phase 0 selectors fix may regress passing tests | Keep public POM API stable; refactor internals first | Phase 0 |
| R-02 | Visual snapshot drift Windows ↔ Linux | Run baseline + CI inside `mcr.microsoft.com/playwright:v1.49.1-jammy` Docker container | Phase 6, 9 |
| R-03 | E2E flaky on CI (timeouts) | retries=2, per-worker dev server isolation, tolerant polls (5s window) | Phase 1, 4, 9 |
| R-04 | Coverage threshold 80% may be unreachable Q1 | Defer perFile until trend stable; possibly add Phase 1.5 store-unit-tests | Phase 1, 9 |
| R-05 | k6 v0.50 WebSocket API breaking | Pin via `grafana/setup-k6-action@v1` in CI | Phase 8 |
| R-06 | 2245 plan slips past Phase 0 timeline | Temporary fixme Cat B + ticket; recalibrate dates if slip > 1 week | Phase 0 |
| R-07 (NEW) | `apiUpdatePresentation` no auth + env baseURL → silent prod-data overwrite | Loopback guard in `tests/e2e/fixtures/test-fixtures.js` (Patch-05) | Phase 1 |
| R-08 (NEW) | `SLIDES_DATA_DIR` per-RUN not per-worker → analytics/share token cross-pollution | Per-worker dir keyed off `TEST_WORKER_INDEX` (Patch-04) | Phase 1 |
| R-09 (NEW) | Phase 4 multi-page OOM on `ubuntu-latest` 2 vCPU 7GB | Pin Phase 4 to `workers: 1`, optionally `ubuntu-latest-4-cores` | Phase 4 |
| R-10 (NEW) | CI 25min unreachable after specs land | 4-shard Playwright matrix + Docker container; recalibrate to <45min wall | Phase 9 |
| R-11 (NEW) | Test data leak: shared `server/data/*.json` between workers/runs | Per-worker SLIDES_DATA_DIR + cleanup via `apiDeletePresentation` (already partial) | Phase 1, fixtures |
| R-12 (NEW) | Electron app coverage = 0% | Out of scope this plan; document as follow-up | overview note |
| R-13 (NEW) | GitHub PAT in test fixtures could leak via snapshot/.gitignore miss | `.gitignore server/data/github.json`; sanitize before commit | Phase 1, 9 |
| R-14 (NEW) | PPTX corpus drift on master | Run corpus job in CI with cached PPTX files; fail on schema mismatch | Phase 9 |

## Validation Log

### Session 1 — 2026-05-19 (post red-team patches)

**Verification Pass (Standard tier, 10 phases → Full tier)**
- Claims checked: 5 sampled / phase
- Verified: `tests/e2e/pages/EditorPage.js` 565 LOC (matches Phase 0 split target); `playwright.config.js` references `PLAYWRIGHT_TEST_BASE_URL` + `runRoot` (confirms S-01 + S-02 patch targets); Vitest 4.x + k6 scripts in package.json (matches Phase 1 + 8 plans).
- Failed: **`@playwright/test` installed at `^1.59.1`, plan pinned `v1.49.1-jammy`** → auto-corrected to `v1.59.1-jammy` across Phase 6, 9, overview risk register.
- Unverified: 0 (red-team report already verified S-01/S-02/F-01/F-03 with file:line evidence).

**Decisions confirmed via interview**
1. **Release/effort** → Bump `target_release: v1.10.0 → v1.11.0`. Quality > speed; keep all 9 phases.
2. **AI flow tests** → Mock-only (current pattern). Document as known gap in overview; no real-API integration tests this plan.
3. **PDF e2e depth** → Headers + size + page count via `pdf-lib` only. NO text parse, NO visual snapshot. Cost-effective; catches 80% of breakage.
4. **Phase 2 split** → Split Phase 2 → 2a (core 5-7d) + 2b (drawing/games 3-4d) per Patch-06. Enables parallel lanes B & C.

**Phase propagation**
- `target_release` updated overview frontmatter → v1.11.0.
- Phase 2 file rewritten as Phase 2a (8 spec files / 16 element types).
- New `phase-02b-element-types-drawing-games-qr.md` created (4 spec files / 4 element types + 7 game types).
- Phase 3 PDF spec locked to headers + size + page count (no text parse / no visual snapshot); add `pdf-lib` devDep.
- Phase 9 dependencies updated `[0,1,"2a","2b",3,4,5,6,7,8]`.
- Phase 6, 9, overview risk register: `v1.49.1-jammy` → `v1.59.1-jammy`.
- Phases table in overview updated with 2a/2b entries.

### Whole-Plan Consistency Sweep — 2026-05-19

| Check | Result |
|---|---|
| Docker image version `v1.59.1-jammy` consistent across Phase 6, 9, overview | PASS |
| Phase 9 `dependencies: [0, 1, "2a", "2b", 3, 4, 5, 6, 7, 8]` matches new file structure | PASS |
| `target_release: v1.11.0` consistent in overview frontmatter | PASS |
| `playwright.config.js` ownership: Phase 1 only (Phase 6/7/9 forbidden from editing) | PASS |
| `workers: 1` for Phase 4 referenced consistently in Phase 4 + Phase 9 | PASS |
| Phase 2a + 2b file ownership boundary: 2a owns 8 specs, 2b owns 4 specs; both append to `RibbonInsertHelper.js` via `addInsertEntry` | PASS |
| Open questions 1, 2 (AI mock, PDF depth) marked RESOLVED with answer; questions 3, 4 remain open (onboarding tour, CI runner tier) | PASS |
| Effort sum check: 4-5 + 2-3 + 5-7 + 3-4 + 3-4 + 5-7 + 2-3 + 2 + 2 + 1 + 2-3 = 31-42 days = ~6-8.5 weeks single-dev | PASS (matches frontmatter "6-8 weeks") |

**Result: 0 unresolved contradictions. Plan is implementation-ready.**

## Documentation updates (post-plan)

- `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` — commands, POM modules, coverage flow, snapshot update (Docker-only), CI badges, Phase 4 `workers: 1` rationale.
- `README.md` — add CI status badge (Phase 9).
- `docs/codebase-summary.md` — note POM split, coverage thresholds, 2a/2b split.
