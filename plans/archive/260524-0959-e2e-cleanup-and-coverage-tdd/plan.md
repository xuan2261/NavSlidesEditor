---
title: E2E Test Cleanup and Coverage Expansion (Post-Review, Post-Audit)
status: completed
priority: P1
flags: [--deep, --tdd]
created: 2026-05-24
revised: 2026-05-24
plan_dir: plans/260524-0959-e2e-cleanup-and-coverage-tdd
related_reports:
  - plans/reports/test-e2e-review-260524.md (original E2E review — source of P0-P3 recommendations)
  - plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/validation-260524.md (validation interview — 5 blocking + 15 decisions)
  - plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/red-team-260524.md (adversarial red-team — 18 issues)
related_plans:
  - 260522-1339-qa-confidence-uplift-5-phase-tdd (complementary, no blocking)
  - 260519-1200-comprehensive-test-coverage-expansion (completed baseline)
user_confirmed_decisions:
  - "Keep + modernize all 4 specs (NOT delete): elements/slides/export/visual-regression"
  - "Visual matrix: 36-cell representative subset (3 themes × 3 transitions × 4 layouts)"
  - "Instrumentation gate: VITE_E2E=1 env flag via page.addInitScript (NOT import.meta.env.MODE)"
  - "All other AI-chosen thresholds accepted as-is (poll intervals, LOC cap, etc.)"
---

# E2E Test Cleanup and Coverage Expansion (Post-Review, Post-Audit)

## Overview

Execute every actionable recommendation from the E2E review report against `tests/e2e/`, `playwright.config.js`, and `tests/e2e/pages/`. Eight phases organised P0 → Final, TDD-first (Red → Green → Refactor). Each phase ships its own verification tests so a phase cannot land "green" without proof. **All factual errors uncovered by red-team + validation have been corrected; user-decided values are locked in frontmatter.**

## Baseline Metrics (verified 2026-05-24 — post-audit)

- Spec files: 60+ under `tests/e2e/`
- `waitForTimeout` occurrences: **20 across 10 files** (anti-pattern, verified via `grep -rn "waitForTimeout(" tests/e2e/`)
- Oversized spec: `tests/e2e/ribbon-layout.spec.js` = **623 LOC** with **9 nested `test.describe` blocks** (organised by concern: clipping, overflow matrix, vertical rhythm — NOT 1-per-tab)
- Missing `data-testid` hotspots: 5 baseline (MediaLibraryModal, ModalShell ×3, HomePage new btn, ribbon-panel) PLUS ~25 additional testids needed by Phases 4-6 (see Phase 3 catalog)
- Coverage gaps confirmed: smart guides, clipboard, hidden elements, PPTX export, markdown import, rclone sync (Proton Drive), game shortcuts G/L
- Config bug: `testIgnore: /tests\/e2e\/live\/.*\.spec\.js/` misses flat `tests/e2e/live.spec.js`
- Coverage % baseline: statements 38.39%, branches 32.17%, functions 33.04%, lines 39.99% (captured in Phase 1; `baseline-coverage.txt`)
- E2E wallclock baseline: 291.05s, exit 1 from existing `coverage-gaps.spec.js` baseline failure (captured in Phase 1; `baseline-wallclock.txt` + command output)

## Phases

| # | Title | Priority | Effort | Status | Depends on |
|---|-------|----------|--------|--------|------------|
| 1 | P0 Quick Wins (config + modernize 4 legacy specs + baseline capture) | P0 | 3h | completed | — |
| 2 | P1 De-flake (waitForTimeout removal — 20 sites) | P1 | 6h | completed | 1 |
| 3 | P1 Selector Hardening (data-testid catalog — full enumeration) | P1 | 4h | completed | 1 |
| 4 | P1 Coverage — Editor Features | P1 | 5h | completed | 3 |
| 5 | P1 Coverage — Export/Import/Sync (real /api/rclone contract) | P1 | 5h | completed | 3 |
| 6 | P1-P2 Coverage — Games + Parametrize visual matrix | P2 | 4h | completed | 3 |
| 7 | P2-P3 Fixture Migration + Architecture (split by concern, not tab) | P2 | 6h | completed | 1, 3 |
| 8 | Final Regression + CI Verification | P1 | 2h | completed | 1-7 |

**Total effort:** ~35h. **Parallelisable:** 4↔5↔6 after 3 lands.
**Dependency change:** Phase 7 now `[1, 3]` (Phase 2 not a blocker — fixture migration consumes Phase 1 fixture additions + Phase 3 testids only).

## Recommendation Coverage Map

| Review Recommendation | Addressed in |
|---|---|
| Fix `testIgnore` regex (live.spec.js leak) | Phase 1 |
| ~~Delete~~ **Modernize** 4 legacy specs (elements/slides/export/visual-regression) | Phase 1 (user-decided: KEEP) |
| Remove `apiRevokeShareToken` identity-replace dead code (was `apiCreateShareToken` — corrected) | Phase 1 |
| Add `assertLoopback()` to `apiGetPresentation` | Phase 1 |
| Capture baseline coverage + wallclock for Phase 8 comparison | Phase 1 (step 0) |
| Strip `waitForTimeout` (20 occurrences, 10 files) | Phase 2 |
| Add 5 baseline + ~25 downstream `data-testid` hooks | Phase 3 (FULL catalog) |
| Cover smart guides feature | Phase 4 |
| Cover clipboard (cut/copy/paste/dup) — paste offset +20/+20 (verified) | Phase 4 |
| Cover element hide/show toggle | Phase 4 |
| Cover PPTX export | Phase 5 |
| Cover markdown import | Phase 5 |
| Cover rclone sync (Proton Drive) — mock real `/api/rclone/*` endpoints | Phase 5 |
| Cover game shortcuts (G toggle HUD, L toggle leaderboard) | Phase 6 |
| Parametrize themes/transitions/layouts — staged framework→snapshots | Phase 6 |
| Migrate to `testPresentation` fixture | Phase 7 |
| Rename PascalCase page objects → kebab-case | Phase 7 |
| Split `ribbon-layout.spec.js` — by 9 actual concerns (NOT 7 tabs) | Phase 7 |
| Update nightly workflow `nightly-ribbon-layout-768px-...yml:31` in same commit | Phase 7 |
| Full green run + coverage delta vs Phase 1 baseline | Phase 8 |

## TDD Convention (applies to every phase)

1. **Red:** write the failing test/assertion describing the desired outcome
2. **Green:** make the smallest change in source/test that turns it green
3. **Refactor:** clean up, deduplicate, run the broader suite locally
4. **Verify:** run the phase's verification gates listed in `phase-NN-*.md → Success Criteria`

## Success Criteria (whole plan)

- [x] All 8 phases marked `status: completed` in their frontmatter
- [x] `npm test` + `npm run test:e2e` exit 0 on Windows + Linux (CI)
- [x] Zero `waitForTimeout(` remaining in `tests/e2e/` outside documented exceptions
- [x] Zero spec file >200 LOC
- [x] CI total e2e wallclock NOT >5% slower than baseline captured in Phase 1
- [x] Coverage % equal-or-higher vs Phase 1 baseline for files touched
- [x] Recommendation Coverage Map shows all recommendations resolved
- [x] README test docs + project-changelog.md reflect new conventions

## Risk Register (post-audit)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `waitForTimeout` → poll migration introduces flakes on slow CI | Medium | Medium | Use generous `expect.poll` intervals (250ms × 40 = 10s); NO `waitForTimeout` fallback (lint-clean state-based only) |
| `data-testid` rename breaks ad-hoc selectors in non-E2E files | Low | Low | Grep before rename; testids are additions (existing class selectors preserved as no-op CSS hooks) |
| Modernizing legacy specs introduces new test assertions that fail in CI | Low | Medium | Each modernization done incrementally; baseline wallclock captured pre-change |
| Splitting `ribbon-layout.spec.js` skews CI shard balance | Low | Low | Re-run sharded job once; rebalance via `playwright.config.js` if needed; profile via `--reporter=list` in Phase 8 |
| Mocking rclone responses diverges from prod | Medium | Medium | Mock at REAL `/api/rclone/*` paths (verified `client/src/utils/api.js:102-116`); add server-side contract test |
| Visual matrix snapshots churn on CI runner upgrades | Medium | Low | Stage: framework first (Phase 6a); baseline 3 representative combos (Phase 6b); structural DOM assertion for the remaining 33 |
| Nightly ribbon-layout 768px workflow breaks after split | High | Medium | Update `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml:31` in SAME commit as the split (Phase 7 deliverable) |
| VITE_E2E flag instrumentation leaks to prod | Negligible | Low | Set via `page.addInitScript` (test-only); no source guard needed; verified zero bundle impact |
| New `data-testid` props leak into prod bundle size | Negligible | Negligible | React renders attrs verbatim; ~180 bytes gzipped; user-confirmed acceptable |

## Out of Scope

- Adding new app features
- Re-baselining Linux visual snapshots (own plan: `260521-2330-...`)
- k6 load test changes (separate scope)
- Electron desktop test additions (separate scope)
- Real rclone integration testing (manual smoke per release; covered by sync server contract test only)

## User-Confirmed Decisions (locked — do NOT silently reverse per review-audit-self-decision.md §3)

1. **Legacy specs (elements/slides/export/visual-regression):** KEEP all 4; modernize in-place (NOT delete). All four have REAL active assertions per verification. `visual-regression.spec.js` is referenced by `manual-update-playwright-visual-baselines.yml:38,45,53` — deleting would break that workflow.
2. **Visual matrix size:** 36-cell representative subset (3 themes × 3 transitions × 4 layouts). Themes: black/white/league. Transitions: none/fade/slide. Layouts: TBD-scout (read `client/src/data/element-defaults.js` LAYOUT_DEFAULTS during Phase 6).
3. **Instrumentation gate:** Use `window.__E2E__ = true` via `page.addInitScript()` (NOT `import.meta.env.MODE === 'test'`, which never fires under Playwright). Client annotation handler guards with `if (window.__E2E__)`.
4. **Thresholds AI-chosen, user-approved:** `expect.poll` intervals `[250]` + timeout 10000ms, spec LOC cap 200, wallclock budget +5%, `maxDiffPixelRatio: 0.02`, paste offset assertion against verified +20/+20 (use-clipboard.js:45,85).

## Reference: file:line citations

All concrete `file:line` citations sourced from scout passes during planning AND re-verified post-audit. They are embedded in each phase's "Related Code Files" section — no need to re-discover.

**Verified API contract (rclone):** `client/src/utils/api.js:102-116` + `server/routes/sync.js:39,46,72,108,143`:
- `GET /api/rclone/status` (was `getRcloneStatus`)
- `POST /api/rclone/config` (was `configureRclone`)
- `POST /api/rclone/sync` (was `syncToRemote`)
- `POST /api/rclone/sync-single` (single presentation push)

**Verified shortcut registry path:** `client/src/utils/default-keyboard-shortcut-definitions-registry.js` (NOT `client/src/data/`)

**Verified component paths:** `client/src/components/SlideCanvas.jsx` (NOT `client/src/components/canvas/SlideCanvas.jsx`)

**Verified ribbon tabs:** `home, insert, design, format, transitions, animations, view` (7 tabs; NO `file` tab — file is a dropdown menu, not a tab)

**Verified game shortcut bindings (EditorPage.jsx:1155-1165):**
- G → `setShowGameHud` toggle (line 1155, REAL state toggle)
- L → `setShowGameLeaderboard` toggle (line 1164, REAL state toggle — NOT a stub as originally claimed)
- Enter/R/P → `console.log` stubs (lines 1162, 1163, 1165 — true stubs)
