# PowerPoint familiar-feel UI polish (TDD)

**Plan:** `plans/260530-1647-editor-powerpoint-familiar-feel-ui-polish-tdd`
**Date:** 2026-05-30
**Approach:** TDD, 4 sequential phases, in-place polish (no rewrite), brand dark/terracotta kept.

## What shipped

Closed 4 PowerPoint familiar-feel gaps on the existing ribbon:

1. **Contextual Format tab** — hidden when nothing selected; relabels by type (Shape Format / Picture Format / Table Design / Chart Design / Code / Media) via `formatTabLabel`; auto-activates on first selection, respects a manual tab change afterwards, falls back to Home when selection clears.
2. **PowerPoint-style status bar** — zoom dropdown → range slider (10–400%), `Slide X / Y` position, Normal/Sorter/Present view switcher; whole editor cluster gates on `slidePosition.total>0`.
3. **Big-button hierarchy** — new `RibbonBigButton` (icon-over-label, ~52px) for Home→Paste, Insert→Text Box + Picture; secondary actions stay compact.
4. **Chrome polish + docs** — design-guidelines + README + changelog synced.

## Key decisions / non-obvious context

- **Store as the bridge, not props.** `StatusBar` renders globally in `MainLayout` (outside the editor tree) and `RibbonHeaderBar`/`TabBar` never received `selectedElement`. Both Format context and slide position/present-handler flow through `ui-store` (new `formatContext`, `slidePosition`, `presentHandler`) instead of prop-drilling — same pattern `zoom` already used.

- **`effectiveTab` guard beats async effects (R1 blocker).** Radix `Tabs.Root value='format'` renders the matching Content even with no trigger, so a persisted `activeTab='format'` + no selection flashes an empty Format panel on reload. Coercing the value synchronously (`activeTab==='format' && !hasSelection ? 'home' : activeTab`) in BOTH `RibbonPanel` and `RibbonHeaderBar` is the only flash-free fix.

- **`setPresentHandler` must use plain `set` (R3 major).** Other `ui-store` setters use the `typeof v==='function' ? v(s) : v` updater idiom. Copying it would call `fn(state)` at registration time and open the present window on every editor mount. A regression test pins "registering does not invoke the handler".

- **EditorPage effect depends on primitives, not the selection object.** `selectedElement` is recomputed via `.find()` each render (new reference every time), so the format-sync effect keys on `hasSelectedElement` (bool) + `selectedElementType` (string) to avoid firing on every render.

- **Big-button keeps stable accessible names.** Visible labels differ from accessible names so e2e helpers and `data-testid` survive: visible "Text Box" / accessible "Add text" / `data-testid="ribbon-insert-text"`. All ribbon buttons fire on `onMouseDown`+`preventDefault` (preserve editor focus) — big-buttons match. Picture uses `onAddImageUpload` (file dialog), the URL-prompt `onAddImage` stays a small button (e2e coverage-gaps needs it).

## Pre-existing failures fixed (user-approved, out of original scope)

Full-suite run surfaced 3 failures unrelated to the 4 phases:

- **`sparkles-icon-semantic-separation.test.jsx`** still asserted Transitions→Wand2 after commit `eb24ac1c` swapped it to Replace. Fixed the stale assertion to match the verified config (intent of the test — "Transitions ≠ Sparkles" — is preserved).
- **`icon-policy-invariants.test.js`** (from the older 260521 icon-consistency plan) forbade Sparkles outside AI files, but the newer `eb24ac1c` intentionally assigned Sparkles to the Animations tab (codified by the passing `ribbon-tabs-config.test.js`). The new decision postdates the guard → whitelisted `ribbon-tabs-config.js` rather than reverting the icon.
- **`electron-release-readiness-contract.test.js`** — release commit `fa874c60` bumped `package.json` to 1.11.0 but left README + codebase-summary at v1.10.0. Synced both to 1.11.0.

## Verification

`npm run lint` (0 errors), `npm run build`, `npm run test` (229 files / 1947 tests passed, 8 skipped, 0 failures).

## Unresolved

- **Tab-liền-panel chrome (Phase 4):** the seamless tab↔panel junction is already achieved by the existing `-mb-px` + matching `bg-background`; no CSS change was made because pixel verification requires a running browser (not available in this environment). The terracotta `border-b-2` active accent is intentional (Phase 1 contextual cue), not a cut. Flagged for manual visual check at ≥1280px and narrow viewports.
- E2e (`npm run test:e2e`) not run here — accessible names + testids were kept stable specifically so the existing ribbon/status e2e selectors still resolve, but a real run should confirm.
