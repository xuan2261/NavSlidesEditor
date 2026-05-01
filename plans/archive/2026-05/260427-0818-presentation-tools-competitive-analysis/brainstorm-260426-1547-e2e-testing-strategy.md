# E2E Testing Strategy - NavSlides Editor
**Date:** 2026-04-26 \| **Author:** Solution Brainstormer

---

## 1. Problem Statement

### What Exists

| Artifact | Status | LOC / Count |
|---|---|---|
| tests/e2e/pages/EditorPage.js (POM) | Done | 537 LOC, class-based |
| tests/e2e/fixtures/test-fixtures.js | Done | API helpers (CRUD, share, snapshot) |
| playwright.config.js | Done | Webserver + trace + 2 workers |
| Spec files | Done | ~22 .spec.js files |
| Chromium-only project | Done | 1 project in config |

Coverage spans: elements, toolbar, slides, undo/redo, keyboard shortcuts, find/replace, properties panel, animation preview, live presentation, sharing, export, settings, templates, AI copywriter, dashboard, version history, media, explore, smoke, hardening regressions, coverage gaps.

### What is Missing

**High-Impact Gaps:**

1. **Element-specific interactions - ZERO coverage.** No tests for: Table (add row/col), Chart (edit data), Code block (syntax), Image (replace/resize), LaTeX (render), Shape (fill/stroke), Line/Arrow (endpoint drag)
2. **Properties panel controls - MINIMAL.** Only 2 basic tests (select/deselect). Color picker, font size, alignment, fill/stroke, border controls: all untested
3. **Copy/Paste - PARTIAL.** Keyboard copy/paste on same slide tested. Cross-slide and cross-presentation: untested
4. **Deletion paths - PARTIAL.** Keyboard Delete tested. Context menu Delete, panel Delete button: untested
5. **data-testid attributes - NONE on property panel controls.** All selectors are CSS-class-based, making tests fragile against Tailwind class renaming (already happened in commit a38a8c5)
6. **Stress / boundary - NONE.** No tests for: 10+ rapid undo/redo, 50+ element insert, drag between slide panel and canvas, keyboard-only canvas navigation (arrow keys)
7. **Visual regression - NONE.** No screenshot diff. Current screenshot.length > 10000 smoke test is a placeholder, not a real test

**Structural Problems:**

8. **EditorPage.js is 537 LOC with 40+ methods** - violates KISS. Hard to maintain, test isolation unclear
9. **No shard strategy** - 22 specs on 2 CI workers will bottleneck at scale
10. **Chromium-only** - reasonable for now, but limits confidence for Firefox/Safari users

---

## 2. Evaluated Approaches

### Approach A: Incremental (Expand from Existing Tests)

Add tests to existing spec files. Refactor EditorPage.js lazily (only when needed).

**Pros:**
- Lowest risk: no rewrite, CI stays green
- Quick wins: element interaction tests added to elements.spec.js

**Cons:**
- EditorPage.js stays large (700+ LOC within 2 sprints)
- CSS selector fragility addressed only reactively, not proactively
- No shard strategy, no visual regression, no boundary tests added
- No end state - keeps growing organically without direction

**Verdict: OVER-ENGINEERED in the wrong direction.** Incremental adds tests without fixing structural debt. The POM refactor never happens until it breaks, and by then it is a forced rewrite under pressure.

### Approach B: Full Rewrite (Split POM + Rewrite Specs from Scratch)

1. Split EditorPage.js into 4 modules + rewrite all spec files from scratch
2. Add visual regression, shard strategy, boundary tests simultaneously

**Pros:**
- Clean slate: no legacy patterns to maintain
- Properly structured POM with clear boundaries

**Cons:**
- **6-8 weeks of work** before CI is green again
- Massive PRs hard to review and merge incrementally
- High risk of breaking existing working tests
- YAGNI violation: visual regression and shards add complexity before proving value
- Dev stops feature work to rewrite tests

**Verdict: OVER-ENGINEERED.** Total rewrite throws away 20+ working spec files and institutional knowledge. The problem is missing coverage, not broken architecture.

### Approach C: Hybrid - Risk/Impact Priority (RECOMMENDED)

**Philosophy:** Fix structural debt that blocks progress (POM split + data-testid), then fill highest-impact coverage gaps. Leave complexity like visual regression and shards for Phase 3 when scale justifies it.

**Phase 1 (1-2 weeks):** Split EditorPage.js into 4 modules + add data-testid to property panel controls. Zero behavioral change to existing tests.
**Phase 2 (2-3 weeks):** Fill P0 coverage gaps (Table, Chart, Properties panel, Copy/paste, Deletion, Undo/redo stress)
**Phase 3 (2-4 weeks, data-triggered):** Visual regression (if tests > 80), shards (if CI > 15 min), Firefox/Safari (if bug reports surface)

**Pros:**
- Clear end state with defined phases
- Structural fix first, coverage gaps second, complexity only when needed
- YAGNI: no visual regression until tests justify it
- KISS: POM split is minimal (4 files), not a framework rewrite
- DRY: shared helpers in test-fixtures.js, not duplicated across specs
- Incremental PRs: each phase reviewable and reversible

**Cons:**
- data-testid addition requires coordinating with component files
- Phase 3 deliberately deferred - team must resist scope creep

**Verdict: Approach C is correct.** Matches how the project actually grows.

---

## 3. Final Recommendation

**Approach C - Phase 1 first.** Start with splitting EditorPage.js into 4 modules AND adding data-testid attributes to the properties panel simultaneously. These are tightly coupled: POM split needs stable selectors, stable selectors need data-testid.

Do NOT start Phase 2 before Phase 1 is merged and stable.

### POM Split Design (KISS)

```
tests/e2e/pages/
  EditorPage.js             # Entry point, delegates to helpers
  CanvasHelper.js           # Canvas interactions, element CRUD
  InsertMenuHelper.js       # Insert menu + element creation
  PropertiesPanelHelper.js  # Property panel interactions
  SlidePanelHelper.js       # Slide management in panel
```

Rule: Each helper class owns only 1 concern. No cross-helper imports. EditorPage.js orchestrates.

### data-testid Naming Convention

```javascript
// Properties panel - add incrementally
data-testid="prop-color-fill"
data-testid="prop-color-stroke"
data-testid="prop-font-family"
data-testid="prop-font-size"
data-testid="prop-align-left"
data-testid="prop-align-center"
data-testid="prop-align-right"
data-testid="prop-lock-toggle"
data-testid="prop-rotation-input"
data-testid="prop-shadow-x"
data-testid="prop-shadow-y"
data-testid="prop-shadow-blur"

// Table-specific
data-testid="table-add-row"
data-testid="table-add-col"
data-testid="table-delete-row"
data-testid="table-delete-col"

// Chart-specific
data-testid="chart-type-select"
data-testid="chart-data-editor"
```

---

## 4. Implementation Plan

### Phase 1: Structural Fix (1-2 weeks)

Goal: Merge POM split + data-testid without breaking existing tests.

**Step 1.1:** Create 4 helper files, copy methods from EditorPage.js, verify all 22 spec files pass (zero behavioral change).
**Step 1.2:** Add data-testid attributes to property panel component files.
**Step 1.3:** Update CSS-class selectors in POM to use data-testid where applicable. Prefer data-testid for property panel; keep CSS for canvas (canvas elements are dynamic).

### Phase 2: P0 Coverage Gaps (2-3 weeks)

Goal: Cover critical paths with zero coverage.

| Priority | Test Area | Spec File |
|---|---|---|
| P0 | Table interactions (insert, add row/col, delete, select cell) | table.spec.js (new) |
| P0 | Chart interactions (insert, edit data, change type) | chart.spec.js (new) |
| P0 | Properties panel controls (color, font, alignment) | properties-panel.spec.js (extend) |
| P0 | Copy/paste cross-slide | clipboard.spec.js (new) |
| P0 | Deletion (context menu + panel button) | elements.spec.js (extend) |
| P1 | Code block interaction | elements.spec.js (extend) |
| P1 | Image replace/resize | media.spec.js (extend) |
| P1 | Shape fill/stroke controls | elements.spec.js (extend) |
| P1 | Undo/redo 10+ operations stress | undo-redo.spec.js (extend) |
| P2 | LaTeX render verification | elements.spec.js (extend) |
| P2 | Line/Arrow endpoint drag | elements.spec.js (extend) |

### Phase 3: Scale (Data-Triggered, 2-4 weeks)

| Trigger | Action |
|---|---|
| Test count > 80 | Add visual regression (Playwright built-in toMatchSnapshot) |
| CI time > 15 min | Add 4 shards, increase workers to 4 |
| Platform-specific bug reports | Add Firefox + Safari projects |
| Debug complexity increases | Add Zustand store inspection helper |

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| POM split breaks existing tests | Medium | High | Zero-behavior-change refactor; all 22 specs must pass before Phase 2 |
| data-testid conflicts with existing attributes | Low | Medium | Verify no duplicates during addition |
| Flaky tests from timing/async | Medium | Medium | Use expect.poll() for async state; waitForAutoSave() before assertions |
| Phase 2 tests slow CI (20+ new specs) | Medium | Medium | Only add Phase 3 shards when CI > 15 min |
| Visual regression produces too many diffs | Low | Low | Only enable when test count > 80; set updateSnapshots: false in CI |
| Frontend dev resists data-testid additions | Medium | Low | Add in same PR as test code; document convention in code-standards.md |

**Biggest risk: Scope creep in Phase 2.** The 11 test areas listed will tempt adding more. Stick to the list. New tests go to backlog.

---

## 6. Success Metrics

| Metric | Baseline (now) | Target (Phase 2 complete) |
|---|---|---|
| Element interaction test coverage | ~15% (insertion only) | 70%+ |
| Properties panel test coverage | ~10% (2 basic tests) | 60%+ |
| Test count | ~40 tests | ~70 tests |
| data-testid coverage on property panel | 0 | 100% (all controls) |
| CSS-class-only selectors in POM | ~90% | <30% (property panel) |
| CI time (estimated) | ~8-12 min | ~10-15 min |
| Flaky test rate | Unknown | <2% |

Measurement: Run npx playwright test --reporter=list monthly. Track flaky rate via playwright show-trace.

---

## 7. Unresolved Questions

1. Who owns adding data-testid to property panel components - frontend dev or test author? (Recommend: test author adds to component files, frontend dev reviews)
2. Should visual regression use toMatchSnapshot() or toMatchDiffSnapshot()? (Playwright built-in, no external dependency needed)
3. Will the team commit to Phase 1 before starting Phase 2? (Refactor must land first - no Phase 2 PRs until POM split merged)
4. Is 10+ undo/redo stress test realistic for user behavior, or is it YAGNI? (Deferred to Phase 3 unless bug reports surface)
5. Should we add data-testid to canvas element wrappers proactively, or only when tests fail? (Proactive - prevents fragility after every UI refactor)

