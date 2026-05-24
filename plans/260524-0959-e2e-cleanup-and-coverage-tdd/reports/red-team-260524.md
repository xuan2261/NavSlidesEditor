---
title: Adversarial Red-Team Review — E2E Cleanup & Coverage Plan
date: 2026-05-24
plan: 260524-0959-e2e-cleanup-and-coverage-tdd
reviewer: code-reviewer (adversarial mode)
verdict: BLOCK — multiple critical fact errors + fabricated API contracts + scope concealment
---

# Adversarial Red-Team Review — E2E Cleanup & Coverage Plan

Plan riddled with stale baselines, fabricated APIs/testids, and silent scope expansion. Recommend rework before any phase lands.

## CRITICAL Issues (blocking)

### C1. `visual-regression.spec.js` is NOT dead — deleting it loses an active visual baseline

**Where:** Phase 1 → "Delete" section. Plan.md line 51-52 also.

**What:** Plan lists `tests/e2e/visual-regression.spec.js` (108 LOC) as a "dead spec" containing "only `test.skip(...)` or pure stubs". Read of the file (verified, lines 1-108) shows: real `test('editor canvas baseline remains stable', ...)`, real `apiCreatePresentation` setup, real `seededSlide` helper, `freezeUiForSnapshot`, `skipNonLinuxVisualSnapshots` guards, and `expect(slideCanvas).toHaveScreenshot('editor-canvas-basic.png', ...)`. Snapshots exist at `tests/e2e/visual-regression.spec.js-snapshots/editor-canvas-basic-chromium-{linux,win32}.png`.

**Why fail:** Deleting this drops the only `editor-canvas-basic` baseline (linux + win32). Phase 1 risk register asserts "verified by reading: all 4 contain only test.skip(...)" — directly false. CI `e2e-visual` job loses coverage silently.

**Fix:** Drop from delete list. Either keep as-is, or merge its baseline coverage into `tests/e2e/visual/editor-canvas-states-*.spec.js` BEFORE deletion. Either way, re-verify the other 3 dead specs by reading their bodies, not relying on plan claims.

### C2. Phase 5 fabricates the entire `/api/sync` contract — endpoints do not exist

**Where:** Phase 5 → "Architecture" + all sync mocks in spec body.

**What:** Plan mocks `/api/sync/status`, `/api/sync/push`, `/api/sync/pull`, `/api/sync/configure`. Actual server routes (verified `server/routes/sync.js:47,73,109,144` + `server/index.js:110`):
- Mount point: `/api/rclone` — NOT `/api/sync`
- Endpoints: `/status`, `/config`, `/sync`, `/sync-single` — NOT `/status`, `/push`, `/pull`, `/configure`
- Client (`client/src/utils/api.js:102-116`) hits `/api/rclone/{status,config,sync,sync-single}`

**Why fail:** Every `page.route('**/api/sync/**', ...)` mock never matches. Real requests pass through and hit rclone shell-out. Tests will either time out or unexpectedly succeed against the real env. The 3 sync tests in Phase 5 are dead-on-arrival.

**Fix:** Rewrite Phase 5 sync mocks to `**/api/rclone/**` with correct path/payload names from `client/src/utils/api.js:102-116` and `server/routes/sync.js`. Re-read SyncModal handler names (`api.syncSingleToRemote`, `api.syncToRemote`, `api.configureRclone`).

### C3. Phase 6 misidentifies the L shortcut as a stub — false TDD premise

**Where:** Phase 6 → "Architecture" + Overview. Plan.md "Recommendation Coverage Map" implies G + L only.

**What:** Plan asserts `EditorPage.jsx:1162-1165` are all `console.log` stubs. Verified contents of those lines:
- 1162 `onGameNext: () => console.log('[game] next phase')` — stub
- 1163 `onGameReveal: () => console.log('[game] reveal')` — stub
- 1164 `onGameLeaderboard: () => setShowGameLeaderboard((v) => !v)` — **NOT A STUB** — real state toggle
- 1165 `onGamePause: () => console.log('[game] pause')` — stub

**Why fail:** Phase 6 lumps `L (open leaderboard)` and stubs together. L is real; Phase 6's "stubs (Enter, R, P) cause no errors" test correctly excludes L — but the architecture commentary is wrong, and any future reader will mis-trust the source citation. Compounds: the `stateAfter === stateBefore` assertion is also fragile — any timer/anim re-render mutates DOM.

**Fix:** Restate: G is `setShowGameHud` toggle (line 1155), L is `setShowGameLeaderboard` toggle (line 1164). Enter/R/P are stubs. Replace `body.innerHTML` snapshot equality with `errors.length === 0 && no new modal visible`.

### C4. Phase 6 cites wrong file path for shortcut registry

**Where:** Phase 6 → "Architecture" + "Related Code Files".

**What:** Cites `client/src/data/default-keyboard-shortcut-definitions-registry.js:31-42`. Actual path: `client/src/utils/default-keyboard-shortcut-definitions-registry.js` (verified via Glob). No file exists under `client/src/data/`.

**Why fail:** The phase's unit verification spec (`game-shortcuts-registry.test.js`) reads from the wrong path → fails immediately on Red. Test author burns time discovering this mid-impl.

**Fix:** Replace all path references in Phase 6 with `client/src/utils/...`. Re-verify line numbers 31-42 (confirmed correct in `utils/` version).

### C5. Phase 1 cites wrong function name for the identity-replace dead code

**Where:** Phase 1 → "Related Code Files" + "Implementation Steps" + Test Tests block.

**What:** Plan says fix `apiCreateShareToken` at `test-fixtures.js:104`. Actual function name is `apiRevokeShareToken` (verified `tests/e2e/fixtures/test-fixtures.js:102-106`). `apiCreateShareToken` does not exist; the file uses `apiCreateShareLink` / `apiCreateShareLinkWithPassword`.

**Why fail:** Plan's Red test `tests/unit/test-fixtures-loopback.test.js` grep regex (`apiGetPresentation[\s\S]*?\n\}`) is valid, but anyone following the prose ("apiCreateShareToken — drop identity-replace") wastes time chasing a nonexistent symbol.

**Fix:** Correct to `apiRevokeShareToken`. Same identity-replace pattern; same fix.

### C6. Baseline metric "34 waitForTimeout across 17 files" is stale by ~50%

**Where:** plan.md "Baseline Metrics" + Phase 2 Overview.

**What:** Plan claims 34 occurrences in 17 files. Verified count via `git grep` / Grep tool: **20 occurrences across 10 files**. Plan even cites specific lines that may have already shifted (e.g. `undo-redo.spec.js:96,104,111`).

**Why fail:** Phase 2 success criterion is "zero `waitForTimeout` outside `RibbonInsertHelper.js:75`" — achievable, but the Red unit test in plan (`tests/unit/no-waitForTimeout.test.js`) is fine. However, the cited line:section refs (e.g. `game-elements.spec.js:213-225, 243`) need re-verification — any drift since baseline = mid-impl confusion.

**Fix:** Re-baseline before Phase 2. Update plan.md table + Phase 2 hotspot list with current `git grep -n` output. Drop the 17-file claim.

## HIGH Severity Issues

### H7. Phase 7 invents a `file` ribbon tab that doesn't exist; misses real `format` tab

**Where:** Phase 7 → "Architecture" + "Split" subsection. Plan.md too (Phase 7 row in coverage map).

**What:** Plan splits into 7 files: `file/home/insert/design/transitions/animations/view-tab.spec.js`. Actual tabs (verified `client/src/components/ribbon/ribbon-panel.jsx:11-19`): `home, insert, design, format, transitions, animations, view` — 7 tabs, but `file` is NOT one; `format` is. The file dropdown menu (`ribbon-file-dropdown-menu.jsx`) is a Button menu, not a ribbon Tab.

**Why fail:** Phase 7 creates `ribbon/file-tab.spec.js` matching DOM that doesn't exist; misses Format tab coverage entirely. Existing `ribbon-layout.spec.js:391` "Format Tab Vertical Rhythm" describe block goes homeless.

**Fix:** Replace 7-file list with actual 7 tabs (`home/insert/design/format/transitions/animations/view`). Also re-read `ribbon-layout.spec.js` — it has 9 top-level + nested `test.describe` blocks (not 7 tab-aligned). Plan's "7 test.describe blocks (one per ribbon tab)" claim is wrong; the file is organised by concern (clipping, overflow matrix, etc.), not by tab. Splitting blindly by tab will scatter related tests.

### H8. Phase 4 silently expands scope: dozens of new testids not in Phase 3

**Where:** Phase 4 spec bodies vs. Phase 3 "Modify (source)" table.

**What:** Phase 4 specs use these testids that no phase creates: `ribbon-tab-view`, `ribbon-tab-insert`, `ribbon-insert-text`, `canvas-area`, `canvas-controls-toggle-smart-guides`, `slide-panel-item`, `view-toggle-selection-pane`, `selection-pane-toggle-visibility-${id}`. Verified ZERO of these exist in client/src today (grep -r data-testid → 21 hits total, none matching these patterns).

**Why fail:** Phase 3 promises "5 new testids". Phase 4 requires ~8 more in source. Either (a) Phase 4 fails on Red and balloons, or (b) implementer silently adds source changes outside the documented scope. CLAUDE.md rule §3 forbids silent user-decision reversal — same principle here: source changes must be visible.

**Fix:** Either (a) expand Phase 3 testid table to include EVERY testid Phase 4-6 consume (call it 15-25 total), or (b) make Phase 4-6 each explicitly own its required testids in their "Conditionally modify" section.

### H9. Phase 2 `window.__lastAnnotation` instrumentation guard does not work

**Where:** Phase 2 → step 7 + Risk Assessment.

**What:** Plan proposes `window.__lastAnnotation` guarded by `import.meta.env.MODE === 'test'`. Verified: Vite dev (`npm run dev`) sets `MODE='development'`; Vite build sets `MODE='production'`. There's no "test" mode for Playwright runs (E2E hits the dev server). Grep for `import.meta.env.MODE` in client/src returns zero hits — there's no existing precedent.

**Why fail:** Either the guard never activates (instrumentation absent → test fails) OR the guard always activates (instrumentation leaks into dev + prod bundle). Plan also doesn't say WHICH file gets the instrumentation.

**Fix:** Use a window flag set by Playwright via `page.addInitScript(() => { window.__E2E__ = true })`, and guard with `if (window.__E2E__)` in the client annotation handler. Or expose via a dedicated debug hook only mounted under `?e2e=1` URL param. Document the file path explicitly.

### H10. Phase 2 reduced-motion fallback double-counts the rule it's trying to eliminate

**Where:** Phase 2 → Risk Assessment, "transitionend never fires" mitigation.

**What:** Mitigation says "race with `page.waitForTimeout(500)` fallback wrapped in `Promise.race` (the ONE allowed timeout — documented)". But Phase 2 Success Criterion #1 is `npm run lint` produces zero `no-wait-for-timeout` errors. If the lint rule is `playwright/no-wait-for-timeout`, even one Promise.race call fails lint. The verification `tests/unit/no-waitForTimeout.test.js` greps `waitForTimeout(` directory-wide → also fails.

**Why fail:** Contradictory acceptance criteria. Either disable lint on the file (which then leaks to anyone copy-pasting) or pick a different fallback (e.g. `expect.poll` with short interval).

**Fix:** Replace `Promise.race(transitionend, waitForTimeout(500))` with `expect.poll(() => locator.evaluate(el => getComputedStyle(el).opacity), { intervals: [50], timeout: 1000 }).toBe('1')` — purely state-based, lint-clean.

### H11. Phase 5 markdown import + PPTX export testids invented

**Where:** Phase 5 spec bodies.

**What:** Uses `[data-testid="home-import-markdown-btn"]`, `[data-testid="ribbon-file-export-pptx"]`, `[data-testid="ribbon-tab-file"]`, `[data-testid="settings-open-sync"]`, `[data-testid="sync-provider-proton-drive"]`, `[data-testid="sync-configure-confirm"]`, `[data-testid="sync-status-configured"]`, `[data-testid="sync-push-btn"]`, `[data-testid="sync-pull-btn"]`, `[data-testid="sync-push-result"]`, `[data-testid="sync-pull-result"]`, `[data-testid="sync-error-toast"]`, `[data-testid="sync-modal-dialog"]`. Verified `ribbon-file-dropdown-menu.jsx` has ZERO testids today; SyncModal has ZERO testids today.

**Why fail:** Same as H8 — silent scope expansion. Phase 5 will land 10+ source modifications under the cover of "selectors won't exist yet; add as Green phase". Reviewer will be blindsided.

**Fix:** Either declare ALL testids in Phase 3, or expand Phase 5 "Modify" list to enumerate every source file + line that gains a testid.

### H12. Phase 6 visual matrix risks unbounded snapshot churn on CI

**Where:** Phase 6 → "Parametrize" section + Risk Assessment.

**What:** Plan generates 36 snapshots (3 themes × 3 transitions × 4 layouts) via `--update-snapshots` on Linux. Risk note says "1.8MB" repo growth. But: every font tweak, reveal.js bump, Chromium update will retake all 36. `maxDiffPixelRatio: 0.02` (2%) is tighter than the global `0.2` in `playwright.config.js:33`. Plan doesn't address font subpixel hinting across CI runner OS versions.

**Why fail:** First Linux CI runner image upgrade → 36 flakes. Project already has visual snapshot pain (per related-plans Linux baseline regen).

**Fix:** Stage in 2 sub-phases: (a) parametrize the FRAMEWORK with no snapshots; (b) baseline a SMALL subset (e.g. 3 representative combos) and assert structural DOM/computed-style only for the other 33. Or use Playwright `expect.toHaveScreenshot` with `threshold: 0.2` matching global config.

## MEDIUM Severity Issues

### M13. Phase 1 testIgnore regex over/under-includes

**Where:** Phase 1 → step 3.

**What:** New regex `/tests\/e2e\/(live(\/.*)?|mobile\/.*|visual\/.*|a11y\/.*)\.spec\.js$/`. Mismatch: `live(\/.*)?` matches `tests/e2e/live.spec.js` only with the `?` group, but the literal `tests/e2e/live.spec.js` has no `/` after `live` AND no path-extension between — needs careful re-read. Also: this implicitly ignores ALL `visual/*` and `a11y/*` from the chromium project. Existing config only ignores `live/.*`. Plan doesn't mention this is a behavior change that affects 6+ specs under `tests/e2e/visual/` and `tests/e2e/a11y/`.

**Why fail:** Phase 1 silently removes 10+ specs from the default chromium project. If those previously ran in chromium → coverage drop. If they never ran → why?

**Fix:** Test all four sub-patterns against actual filenames. Confirm intent: were `visual/*` + `a11y/*` historically scoped only to specific Playwright projects? Read existing project definitions before changing.

### M14. Phase 7 fixture-migration regex too greedy

**Where:** Phase 7 → step 1 verification spec.

**What:** Regex `fetch.*api/presentations\|request\.post.*api/presentations`. Matches `fetch.*api/presentations/X/share` (legitimate Phase tests that need raw share calls). Will produce false positives that block migration.

**Fix:** Anchor more precisely: `(fetch|request\.post)\(\s*['"\`]\s*\$?\{?[\w\.]*?\}?\/?api\/presentations['"\`]?\s*,` — and exclude `/share`, `/snapshot` sub-paths.

### M15. CI shard rebalance unaddressed

**Where:** Phase 7 → Risk Assessment + Phase 8 → Success Criteria.

**What:** Splitting ribbon spec from 1 file × 623 LOC into 7 × ~90 LOC changes Playwright's per-file shard distribution. `playwright.config.js:21` sets `workers: process.env.CI ? 2 : 4` and no explicit shard config. Plan says "re-time shard distribution in Phase 8" — but Phase 8 just runs the suite and hopes.

**Why fail:** One CI shard could end up doing all 7 ribbon files; another idle. Wallclock budget (≤+5%) may bust.

**Fix:** Phase 8 should profile shard balance via `--reporter=list` timings + explicit `playwright.config.js` shard tuning, not rely on default round-robin.

### M16. Plan mode field invalid

**Where:** plan.md frontmatter `mode: --deep --tdd`.

**What:** This frontmatter isn't parseable as a single mode — looks like two CLI flags pasted into a YAML scalar. If any tool reads `mode`, it'll treat the whole string as one value.

**Fix:** Either split into `flags: [--deep, --tdd]` or document the convention. Cosmetic but signals sloppy plan hygiene.

## LOW Severity Issues

### L17. Phase 8 plan-completion-gate test reads phases via `gray-matter` — dep unconfirmed

**Where:** Phase 8 → meta-test.

**What:** `import matter from 'gray-matter'`. Confirm `gray-matter` is in devDependencies before this test ships. If absent, Vitest fails on import.

**Fix:** Add `npm i -D gray-matter` to Phase 8 prep, or use a 5-line YAML frontmatter parser.

### L18. Test that greps source for `element.hidden|el.hidden` will false-positive on coverage HTML

**Where:** Phase 4 → verification block `element-hide-feature-source.test.js`.

**What:** `readFileSync('client/src/components/canvas/SlideCanvas.jsx')` — but real file is `client/src/components/SlideCanvas.jsx` (no canvas/ subdir, verified via Glob). Will throw ENOENT.

**Fix:** Update path everywhere in Phase 4. Same risk applies to Phase 4 "Architecture" section claims `SlideCanvas.jsx:458` / `:478` — confirmed correct lines in the right file, but the path prefix `canvas/` is wrong.

## Unresolved Questions

1. Is `tests/e2e/visual-regression.spec.js` truly redundant with `tests/e2e/visual/editor-canvas-states-*.spec.js`? If yes, migrate the `editor-canvas-basic` snapshot first; if no, keep the file. Needs side-by-side diff of the snapshot coverage they each provide.
2. What Playwright project is supposed to run `tests/e2e/visual/*` and `tests/e2e/a11y/*`? Current config has only `chromium` + `chromium-live` + optional `mobile-chromium`. Are visual/a11y specs already orphaned and never executing?
3. Does the `e2e-visual` CI job exist as stated in plan.md L91? Could not verify (no `.github/workflows/` read attempted) — flagged for confirmation before deleting `visual-regression.spec.js`.
4. Is there an existing `ribbon-tab-{name}` testid convention used by any passing spec? If so, where? If not, Phase 3 needs to either add the full set OR Phase 4-6 need to fall back to `[role="tab"][aria-controls=...]` queries.
5. What's the source of the "5 missing data-testid hotspots" claim in plan.md L26? Other phases (4, 5, 6) reference many more.

## Recommended Action

**DO NOT START Phase 1 as written.** Recommend a planning revision sweep:
1. Re-baseline waitForTimeout count + file list.
2. Verify each "delete" target by reading its body.
3. Enumerate the full data-testid catalog (Phase 3 + downstream phases).
4. Rewrite Phase 5 against the real `/api/rclone/*` contract.
5. Correct file paths and function names in Phase 1 + Phase 4 + Phase 6.
6. Re-verify Phase 7 split against actual tab list.

Once corrected, the plan structure (TDD-first, verification gates) is sound — the failure is fact-checking discipline, not architecture.
