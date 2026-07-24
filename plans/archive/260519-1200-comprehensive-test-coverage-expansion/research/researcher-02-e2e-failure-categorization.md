# E2E Failure Categorization — Baseline 2026-05-19

> Source: `npx playwright test --reporter=list` against current `master` (HEAD 51b83408 — phase-9 ribbon review fix). Total: **35 failed, 1 flaky, 210 passed** (15.6 min). Log: `plans/reports/e2e-baseline-260519.log`.

## Summary by category

| # | Category | Tests fail | Likely root cause | Severity |
|---|---|---|---|---|
| A | Ribbon layout @ 768px / 1024px overflow | 12 | UI regression after ribbon v1.9.0 hardening | P0 |
| B | Ribbon UI/UX a11y audit | 6 | Tab indicator/color contrast/primary button gating moved | P0 |
| C | AI modal flows (Copywriter/Generator/Translate) | 3 | Selector cho AI dropdown menu thay đổi | P0 |
| D | Editor.spec — Sync/Version History/text-editing chrome | 3 | Modal Escape/overlay click selector + auto-save retry | P1 |
| E | Live presentation modals | 3 | `editor.startBroadcast()` Share dropdown selector broken | P0 |
| F | Sharing — Share modal open | 1 | Same Share dropdown selector issue | P0 |
| G | Element insertion — Table prompt / LineHeight / multi-element seed | 3 | Insert flow prompt + properties panel control selector | P1 |
| H | Coverage-gaps spec — rotation/rulers + footer/feature modals | 2 | Selectors thay đổi (rulers button, custom CSS button) | P1 |
| I | Element-lifecycle — autosave failure retry | 1 | Backend mock route hoặc retry button selector | P1 |
| J | Visual regression — canvas baseline | 1 | Snapshot mismatch (cần update sau ribbon redesign) | P2 |

## Detailed list

### Category A — Ribbon layout (12 tests, 1 flaky đã pass retry)

```
ribbon-layout.spec.js:73   Insert tab section triggers @ 1280px
ribbon-layout.spec.js:144  Insert tab no overflow @ 1024px
ribbon-layout.spec.js:144  Insert tab no overflow @ 768px
ribbon-layout.spec.js:162  Home tab Font/Paragraph @ 1280px
ribbon-layout.spec.js:260  All tabs no clip @ 768px (×7: Home, Insert, Design, Format, Transitions, Animations, View)
ribbon-layout.spec.js:317  Home tab usable @ 768px
ribbon-layout.spec.js:380  Tab navigation @ 768px
```

**Hypothesis:** ribbon refactor in 51b83408 (phase-9 review fix) changed flex layout — sections now overflow at narrow viewports because mới thêm Save status button + Present primary CTA chiếm chỗ. Tests dựa vào button count + clip-detection logic.

**Action:** Read `client/src/components/ribbon/RibbonPanel.jsx` and `RibbonHeader.jsx` to confirm; either fix UI OR adjust test viewport thresholds to current acceptable behavior.

### Category B — Ribbon UI/UX a11y audit (6 tests)

```
ribbon-ui-ux-accessibility-audit-phase-gate.spec.js:31   active tab indicator visible in both themes
ribbon-ui-ux-accessibility-audit-phase-gate.spec.js:44   Preview button opens TransitionPreview modal
ribbon-ui-ux-accessibility-audit-phase-gate.spec.js:56   color contrast in both themes (FLAKY — passed retry)
ribbon-ui-ux-accessibility-audit-phase-gate.spec.js:103  header has exactly one variant=primary button
ribbon-ui-ux-accessibility-audit-phase-gate.spec.js:111  arrow-key navigation cycles tabs
ribbon-ui-ux-accessibility-audit-phase-gate.spec.js:129  header survives 200% zoom @ 1280×800
```

**Hypothesis:**
- Active indicator selector probably changed from class-based to data-attr.
- Preview button may have moved to different tab or renamed.
- Multiple primary buttons (Save+Present?) → one variant=primary expectation broken.
- Arrow-key nav: probable Radix migration changed focus model.
- 200% zoom + horizontal scroll: layout regression.

**Action:** read each failing test ~5 lines around the assertion + grep current ribbon component for matching selector.

### Category C — AI modals (3 tests)

```
ai.spec.js:22  AI Copywriter mocked   (timeout 30s on click)
ai.spec.js:55  AI Slide Generator    (timeout 30s)
ai.spec.js:63  Translate Presentation (timeout 30s)
```

**Hypothesis:** all use `page.click('button.menu-trigger:has-text("AI")')` → ribbon refactor likely moved AI menu to a different element (maybe tab button thay vì menu-trigger). Need to update `editor.openAICopywriter()` helper + spec direct calls.

### Category D — Editor.spec (3 tests)

```
editor.spec.js:22   Sync/Version History modals close on Escape and overlay
editor.spec.js:60   Version History inline errors and retry
editor.spec.js:253  editor chrome keeps text editing mounted and toolbar within bounds
```

**Hypothesis:** File menu trigger selector or toolbar overflow check. The chrome test uses `getToolbarOverflowMetrics` which depends on `.tour-step-ribbon` — same root as A.

### Category E — Live presentation modals (3 tests)

```
live.spec.js:96   Present Live button opens modal
live.spec.js:107  Live room URL contains room code
live.spec.js:119  Modal shows room/viewer/remote/speaker links
```

**Hypothesis:** `startBroadcast()` does `page.click('button.menu-trigger:has-text("Share")')` → Share menu moved/renamed in ribbon. Same root as F.

### Category F — Share modal (1 test)

```
sharing.spec.js:24  open Share Modal
```

Same root as E.

### Category G — Element insertion (3 tests)

```
elements.spec.js:23                                Insert text+shape+table prompt override
toolbar-elements.spec.js:72                        Insert Table with prompt override
parallax-element-insertion-...spec.js:98           LineHeight control visible for text
```

**Hypothesis:**
- Table insertion uses `prompt()` dialog override; toolbar selector may have moved.
- LineHeight may have moved to Format tab vs Home.

### Category H — Coverage-gaps (2 tests)

```
coverage-gaps.spec.js:214  resize aspect lock + rotation snap + rulers + persistent guides
coverage-gaps.spec.js:274  footer settings + feature modals + responsive + visual smoke
```

**Hypothesis:**
- Rulers toggle button name changed.
- Custom CSS button moved between View/Design tab.
- Responsive 390x844 viewport may collide with ribbon layout regression.

### Category I — Autosave retry (1 test)

```
element-lifecycle.spec.js:216  autosave failure keeps local changes visible and retry persists
```

**Hypothesis:** Retry button label or save status badge selector changed (the v1.9.0 release notes mention "focusable inline save status").

### Category J — Visual regression (1 test)

```
visual-regression.spec.js:26  editor canvas baseline remains stable
```

**Action:** regenerate baseline after Phase 0 fixes settle (`--update-snapshots`).

## Recommended Phase 0 work order

1. Read 1-2 failing specs from each category, confirm root cause.
2. Read corresponding component (`RibbonHeader.jsx`, ribbon Insert/Home tabs) once.
3. Update `EditorPage.js` helpers to match new selectors:
   - `openAICopywriter` (Category C)
   - `startBroadcast` + `openShareModal` (Categories E, F)
   - `openFileMenuItem` (Category D)
   - `addToolbarElement` Table prompt (Category G)
4. Update individual specs that bypass POM helpers.
5. Decide: fix UI OR adjust expectations for ribbon-layout thresholds (A) — ask user if width 768px is in-scope for v1.9.0 acceptance.
6. Regenerate visual baseline last (J).
7. Re-run full e2e until 0 fail / 0 flaky.

## Open questions
- Has phase-9 ribbon review intentionally moved Share/AI/File menus into different ribbon tabs (not "menu-trigger" anymore)? If yes, EditorPage helpers need rewrite, not minor fix.
- Should 768px viewport be a hard support target? Some Ribbon-layout tests may be outdated relative to current product spec.

---

**Status:** DONE
**Summary:** 35 failures phân thành 10 categories — ~70% là selector regression sau ribbon refactor v1.9.0. Phase 0 chỉ cần ~2-3 ngày nếu UI giữ nguyên, ~1 tuần nếu phải fix UI overflow.
