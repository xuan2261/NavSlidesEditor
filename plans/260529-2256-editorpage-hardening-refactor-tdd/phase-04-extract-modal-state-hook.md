---
phase: 4
title: "Centralize Modal State In ui-store"
status: pending
priority: P1
effort: "1.5-2d"
dependencies: [3]
---

# Phase 4: Centralize Modal State In ui-store

> **Red Team #2 (Critical) — applied.** The original plan created a NEW `use-editor-modals` hook + test, but `client/src/stores/ui-store.js` ALREADY centralizes modal state: generic `openModal`/`closeModal`/`toggleModal` helpers (`ui-store.js:44-46`), boolean state + convenience setters for Github/Share/History/Sync/Template (`:17-21`, `:49-53`), and is already unit-tested (`ui-store.test.js`). EditorPage already imports `useUIStore` (`:50`) and uses it for panels/zoom/ribbon (`:188-191`) while DUPLICATING the same modal flags as local `useState` (`showGithubModal:205`, `showShareModal:208`, `showSyncModal:211`, `showHistoryModal:212`, `showTemplateModal:201`). A new hook would be a THIRD modal-state system with `setShowGithubModal` defined in two places → desync. Phase retargeted: migrate the modal flags INTO `ui-store`, delete the local duplicates, no new state hook.

## Overview

First god-component extraction: move the ~25 editor modal/visibility flags out of `EditorPage` local `useState` and into the EXISTING `ui-store` (extending its generic `openModal('Name')` pattern), AND move the ~550-line modal-mount JSX block (`EditorPage.jsx:1406-2069`) into an `<EditorModals>` presentational component. Pure refactor — zero behavior change, characterization suite stays GREEN. The JSX lift is the single biggest LOC lever (~350 lines); the state move deletes ~25 `useState` lines AND removes existing duplication (5 flags already in `ui-store`).

## Requirements

- Functional: every modal still opens/closes exactly as before; the 5 flags currently duplicated between EditorPage local state and `ui-store` (`showGithubModal`/`showShareModal`/`showSyncModal`/`showHistoryModal`/`showTemplateModal`) resolve to a SINGLE source (the store).
- Non-functional: EditorPage loses ~22 boolean-modal `useState` lines (payload modals stay local); no new state hook/file created; modal state centralized in the already-tested store and individually testable there.

## Architecture

- **Reuse, don't reinvent.** `ui-store` (`client/src/stores/ui-store.js`) already owns 5 modal flags + generic `openModal`/`closeModal`/`toggleModal(name)` + convenience setters, all tested. Extend it with the remaining ~20 flags rather than adding a parallel hook.
- Today EditorPage holds a flat list of booleans/objects (`:198-247`): `htmlEditorState`, `codeEditorState`, `latexEditorState`, `showTemplateModal`, `showTemplateGallery`, `galleryPreviewTemplate`, `showMediaLibrary`, `showGithubModal`, `showTransitionPreview`, `showAnimationPreview`, `showShareModal`, `showSyncModal`, `showHistoryModal`, `showCssEditor`, `showAICopywriter`, `showAIGenerator`, `showAITranslate`, `showLiveModal`, `showAnalytics`, `showImageUrlPrompt`, `showCommandPalette`, `showKineticTextModal`, `showMathGridModal`, `showAnimeModal`, `showThreeModal`, `showFileBrowser`. Five of these (Github/Share/Sync/History/Template) ALREADY exist in `ui-store` — EditorPage currently shadows them with local `useState`, a latent desync bug this phase also fixes.
- **Boolean `show*` flags → `ui-store`.** Add the ~20 missing booleans to the store using the existing `openModal('Name')`/`closeModal('Name')` convention; expose convenience setters where call sites currently use `setShowX(bool)` so the diff stays mechanical. EditorPage reads them via `useUIStore` (already imported at `:50`).
- **Payload modals stay local.** The three editor-content modal states that carry payload (`htmlEditorState`, `codeEditorState`, `latexEditorState`) and any non-boolean object state (`galleryPreviewTemplate`) are NOT pure visibility flags — keep them as `useState` in EditorPage (or pass into the element-creation hook in Phase 5). Do not force them into the store.
- **`<EditorModals>` component**: lift the scattered modal-mount JSX (`:1406-1467` Github/Sync/History/SlideSorter + `:1666-2066` Html/Code/Latex/FindReplace/Timeline/Animation/Transition/Share/Analytics/AICopywriter/AIGenerator/AITranslate/Live/Template/CSS/Media/CommandPalette/embed modals/ImageUrlPrompt/TemplateGallery/TemplatePreview) into one presentational `EditorModals.jsx`, fed via props. **EXCLUDE the editor body** (`:1469-1664`: SlidePanel/RibbonPanel/SlideCanvas/PropertiesPanel) — that stays inline in EditorPage. **Also note: `BlackScreenOverlay` (`:1916`) is REMOVED in Phase 2 — confirm it is already gone before lifting this range to avoid a double-edit conflict.** Net JSX moved ≈ 350 lines.
- Do NOT move `liveRoomCode`/`livePresenterToken` (they pair with live flow logic, not pure UI) — defer to Phase 5.

## Related Code Files

- Modify: `client/src/stores/ui-store.js` — add the ~20 missing boolean modal flags (default `false`) alongside the existing 5; reuse the generic `openModal`/`closeModal`/`toggleModal(name)` actions; add convenience `setShowX(v)` setters only where call sites need the `setShowX(bool)` signature to keep the EditorPage diff mechanical.
- Modify: `client/src/stores/ui-store.test.js` — extend existing tests to cover the newly-added flags (defaults closed; open/close/toggle via the generic helpers; representative convenience setters).
- Create: `client/src/components/EditorModals.jsx` (presentational; renders the lifted modal blocks, props-driven; < 200 LOC — split into two sub-files if it exceeds the cap)
- Create: `client/src/components/EditorModals.test.jsx` (conditional-render: each `show*` prop true → its modal present)
- Modify: `client/src/pages/EditorPage.jsx` — delete the ~22 boolean `useState` modal decls (incl. the 5 that currently SHADOW `ui-store`); read flags + setters from `useUIStore` (already imported `:50`); keep payload modal states (`htmlEditorState`/`codeEditorState`/`latexEditorState`/`galleryPreviewTemplate`) as local `useState`; replace the lifted JSX (`:1406-1467` + `:1666-2066`) with a single `<EditorModals ... />`; keep editor body (`:1469-1664`) inline.
- Read for context: `client/src/stores/ui-store.js` (`:15-77`), `client/src/stores/ui-store.test.js`, `client/src/pages/EditorPage.jsx` (`:198-247`, `:1406-2069` + all `setShow*`/`show*` usages), and grep `useUIStore` consumers (RibbonPanel/StatusBar) to confirm no flag-name collision when adding store flags.

## Implementation Steps

1. **RED**: extend `ui-store.test.js` — assert the newly-added flags default closed; `openModal('AICopywriter')` flips `showAICopywriterModal` (or chosen name); `toggleModal`/`closeModal` work; representative convenience setters (`setShowAIGenerator(true)`) flip the right flag. Fails (flags not yet added). Also write `EditorModals.test.jsx` RED (component absent).
2. **GREEN (store)**: add the ~20 missing booleans + setters to `ui-store`, matching the existing naming so EditorPage call sites change only their source (`useState` → `useUIStore`). Decide one naming convention and apply uniformly (the existing flags use `show{Name}Modal`; some EditorPage flags are `show{Name}` without `Modal` — normalize and update call sites in the same mechanical pass).
3. In EditorPage: delete the migrated boolean `useState` lines (including the 5 duplicates of store flags); destructure flags + setters from `useUIStore`. Mechanical find/replace; no logic edits. Keep payload modal `useState` as-is.
4. **GREEN (component)**: implement `EditorModals.jsx` props-driven; replace the two lifted JSX ranges with `<EditorModals ... />`. Confirm `BlackScreenOverlay` already removed by Phase 2 first.
5. Run Phase 1 characterization suite + extended store test + `EditorModals` test → all GREEN.
6. **REFACTOR**: grep every old local `setShow*`/`show*` reference to ensure none dangle; remove unused imports. Lint.

## Success Criteria

- [ ] `ui-store` holds all ~25 boolean modal flags (5 pre-existing + ~20 added), unit-tested (defaults + open/close/toggle + representative setters); NO new `use-editor-modals` hook file created.
- [ ] The 5 previously-duplicated flags (Github/Share/Sync/History/Template) now have a single source (store); EditorPage local `useState` for them deleted (desync bug fixed).
- [ ] EditorPage boolean-modal `useState` count drops by ~22; payload modal states retained locally.
- [ ] `<EditorModals>` component renders all lifted modal blocks props-driven; editor body stays inline; conditional-render test green.
- [ ] EditorPage JSX reduced by ~350 lines (modal-mount blocks lifted).
- [ ] Phase 1 characterization suite GREEN (no behavior change).
- [ ] Every modal verified open/close in browser smoke (Phase 7 full sweep; spot-check key ones here).
- [ ] Lint clean, no unused imports; no dangling `setShow*` references.

## Risk Assessment

- **Risk (Critical, now mitigated):** Building a third parallel modal-state system. **Mitigation:** phase retargeted to extend the existing tested `ui-store`; no new state hook.
- **Risk:** Flag-name mismatch — EditorPage uses both `show{Name}` and `show{Name}Modal` styles; store uses `show{Name}Modal`. **Mitigation:** pick one convention in step 2 and update all call sites in the same mechanical pass; grep each name before/after.
- **Risk:** Moving flags to a global store changes re-render scope (any store update re-renders all `useUIStore` consumers). **Mitigation:** Zustand re-renders only subscribers of changed slices when selectors are used; have EditorPage select the specific flags it reads, not the whole store object.
- **Risk:** Missed a `setShow*` reference → runtime crash. **Mitigation:** grep each migrated symbol; rely on characterization render test to catch undefined setters.
