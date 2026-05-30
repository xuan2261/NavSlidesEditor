---
phase: 6
title: "Vertical Slide Full Support"
status: pending
priority: P1
effort: "2-2.5d"
dependencies: [5]
---

# Phase 6: Vertical Slide Full Support

> **Red Team — applied.**
> - **#1 (Critical):** "Single source of mutation" was FALSE. Element-writing paths NOT in the original inventory: clipboard paste/cut/duplicate via `use-clipboard.js:123` (`getCurrentSlideIndex` → `EditorPage.jsx:1067` returns `currentSlideIndex`), media-library insert (`:1904-1909` uses `currentSlideIndex` directly in JSX), and the inline duplicate at `:1100-1109` (uses `currentSlideIndex` state). If only `update/add/deleteElement` are generalized, pasting/duplicating/media-inserting while a CHILD is active writes to the PARENT → element silently lands on the wrong slide. ALL write paths must route through `mapActiveSlide`.
> - **#5 (High):** `currentVerticalIndex` reconciliation was specced only for slide-change + parent-delete. Slide **reorder/move** (reset effect keyed only on `[currentSlideIndex]` at `:464`) and **undo/redo** (`handleUndo:993`/`handleRedo` clamp only `currentSlideIndex`, and were NOT in the modify list) leave a stale `{parent,child}` → `activeSlide` undefined → crash. Prefer tracking the parent by slide **id** so reorder is stable.
> - **#6 (High):** the new `{parent,child}` shape COLLIDES with the existing **flat** `verticalIndex` convention (0=parent, child=childIndex+1) used across socket/live/export (`socket-handler.js:63`, `htmlGenerator.js:287`, `LiveViewPage.jsx:89`, `animation-preview-helpers.js:26`). "Align naming" is not enough — rename the new editor state (e.g. `editTarget`/`activeChildIndex`) and document the `{parent,child}` ↔ flat conversion (child N ⇒ verticalIndex N+1).
> - **#13 (Medium):** vertical export is ALREADY implemented (`htmlGenerator.js:142-157`, guarded on `children.length`). Demote the export sub-task to a lock test; do not re-implement.
> - **#14 (Medium):** "SlideCanvas just works with a child" is unverified — the call site derives `pageNumber`/`section`/footer from the PARENT `currentSlide` (`:1592-1610`) and children lack those fields. Enumerate every SlideCanvas prop and decide parent-vs-child per prop before wiring.
> - **#12 sequencing (acknowledged):** the element callbacks generalized here are the ones Phase 5 just extracted into `use-element-creation` — edit them in the hook, not the original site, and re-run the characterization suite after.

## Overview

Make vertical (child) slides first-class: a created `slide.children[*]` can be selected, edited on the canvas, navigated, duplicated, deleted, and exported. Today children are created (`EditorPage.jsx:1498`) and rendered in the panel (`SlidePanel.jsx:413-450`) but unreachable for editing because EditorPage never wires `onSelectVertical`/`currentVerticalIndex` and the canvas only renders top-level `currentSlide` (`:392`). The risk surface is broad — every element write path and every index-reconciliation trigger must be covered, not just the three obvious callbacks.

## Requirements

- Functional: unified slide addressing `{ slideIndex, childIndex|null }`; clicking a child in the panel edits that child on the canvas; **ALL element ops (add/update/delete/select/group/z-order/clipboard/media-insert/duplicate) target the active child when one is selected — every write path, not just the three obvious callbacks**; add/delete/duplicate child; vertical export renders nested `<section>`.
- Non-functional: addressing model reusable by present/find-replace/animation later AND explicitly bridged to the existing flat `verticalIndex` convention (no silent off-by-one); no regression to horizontal-only flows; `migrateSlide` handles legacy children; `currentVerticalIndex` never goes stale across reorder/undo/parent-delete.

## Architecture

- **Addressing (naming disambiguated — #6):** introduce `currentVerticalIndex` state `{ parent: number, child: number } | null` (this exact name + shape is what `SlidePanel.jsx:418` already expects — keep it for the panel prop). `child===null` ⇒ editing the parent. Derived `activeSlide` = `child===null ? slides[parent] : slides[parent].children[child]`. **This `{parent,child}` editor model is DISTINCT from the pre-existing FLAT `verticalIndex` convention** (0=parent, child=`childIndex+1`) used by socket/live/export (`socket-handler.js:63`, `htmlGenerator.js:287`, `LiveViewPage.jsx:89`, `animation-preview-helpers.js:26`). Do NOT introduce any new variable also named `verticalIndex`. Add one small documented converter `toFlatVerticalIndex({parent,child}) => child==null ? 0 : child+1` (and inverse) for the future present/live-nav wiring; note in a comment that the two models intentionally differ.
- **Parent-by-id for stability (#5) — LOCKED (Validation Session 1):** key the active parent by slide `id`, resolving its array index at read time, so a reorder never silently re-points the active parent at a different slide. `currentVerticalIndex` keeps the `{parent,child}` SHAPE for the `SlidePanel.jsx:418` prop (derive `parent` = current index of the tracked id at render), but internal truth is the parent `id` + `child`. This makes slide reorder/move reconciliation-free (the id resolves to wherever the slide moved); explicit reconciliation is then needed only for parent-DELETE and undo/redo (when the tracked id may no longer exist or the child index may exceed the restored `children.length`). <!-- Updated: Validation Session 1 — parent-by-id LOCKED -->
- **(Locked above — parent-by-id.)** The index-based alternative is rejected per Validation Session 1; reorder needs no `currentVerticalIndex.parent` re-point because the active parent is resolved from its tracked slide `id` at read time.
- **Single source of mutation — ENUMERATE EVERY WRITE PATH (#1, Critical):** the obvious `updateElement`(`:520`)/`addElement`(`:564`)/`deleteElement`(`:539`)/`updateElements` resolve `slides[currentSlideIndexRef.current]`. But these are NOT the only writers. Generalize ALL of the following through a single `mapActiveSlide(prev, fn)` helper (DRY) that resolves parent-or-active-child:
  - the three element callbacks above + `updateElements`;
  - **clipboard** paste/cut/duplicate in `use-clipboard.js` (resolves via `getCurrentSlideIndex` `:123` → `EditorPage.jsx:1067` returns `currentSlideIndex`) — pass an active-slide-address resolver into the hook instead of `getCurrentSlideIndex`;
  - **inline duplicate** at `EditorPage.jsx:1100-1109` (uses `currentSlideIndex` state directly);
  - **media-library insert** at `EditorPage.jsx:1904-1909` (uses `currentSlideIndex` directly in JSX);
  - `use-slide-operations` group/ungroup/align/`deleteSelectedElements`/`updateElements` (they resolve current slide internally).
  Grep `currentSlideIndex`/`currentSlideIndexRef`/`getCurrentSlideIndex` repo-wide to build the exhaustive writer list before coding; any writer not routed through `mapActiveSlide` will silently target the parent.
- **Panel wiring:** pass `currentVerticalIndex` + `onSelectVertical` from EditorPage to `SlidePanel` (`:1472`). Selecting a child sets `currentVerticalIndex`, clears element selection/editing.
- **Canvas (enumerate props, decide parent-vs-child per prop — #14):** `SlideCanvas` currently receives ~15 sibling props alongside `slide`, several computed from the PARENT `currentSlide` / top-level slides array: `pageNumber` (IIFE over `presentation.slides` `:1592-1602`), `totalSlides` (`:1602`), `sectionName={currentSlide?.section}` (`:1603`), `activeSection={currentSlide?.activeSection}` (`:1610`), footer flags. Read `SlideCanvas.jsx` and list every prop it consumes; for each decide whether the child or parent value applies: **body-affecting props** (`slide.elements`, background) → active child; **deck-chrome props** (page-number, section label, footer, total) → parent (children lack `section`/`showPageNumber`, `:1499-1504`). Pass `activeSlide` only for the body-affecting props; keep chrome parent-derived. Do NOT assume "just works."
- **Slide CRUD for children:** extend `use-slide-operations` with `addChildSlide`/`deleteChildSlide`/`duplicateChildSlide` (reuse `slide-operation-helpers.js` which already clones `children` at `:20`).
- **Migration:** `migrateSlide` (`:131`) must recurse into `children` (legacy children may lack `elements`). `slide-notes.js:20` already normalizes child notes — reuse, don't duplicate. (Confirm whether newly-created children via `onAddVerticalSlide` `:1498` already carry an `elements` array; if not, migration recursion is load-bearing for new children too, not just legacy decks.)
- **Export (ALREADY IMPLEMENTED — lock test only, #13):** `shared/src/htmlGenerator.js:142-157` ALREADY emits nested vertical `<section>` for `slide.children`, guarded on `slide.children.length > 0`. Do NOT re-implement. Add a lock/snapshot test asserting the existing nesting is preserved, AND confirm child element `content` routes through the same sanitizing `renderText` path as parent elements (no unescaped child injection).
- **Index safety — reconcile on triggers (#5, parent-by-id LOCKED):** because the active parent is tracked by slide `id` (resolved at read time), **slide reorder/move is reconciliation-free** — the id follows the slide. `currentVerticalIndex` still must be clamped/reset on (a) slide-change (the `:455-464` reset effect — currently keyed only on `[currentSlideIndex]`), (b) parent delete (tracked id no longer exists → reset to `child:null`), and (c) **undo/redo** (`handleUndo:993`/`handleRedo:996` clamp only `currentSlideIndex` and must also clamp `currentVerticalIndex.child` against the restored `slides[parent].children.length`, resetting to `child:null` if out of range or if the tracked parent id is gone). Reorder (`use-slide-operations` `:248-318`) needs no explicit trigger under parent-by-id.

## Related Code Files

- Modify: `client/src/pages/EditorPage.jsx` — add `currentVerticalIndex` state+ref (active parent tracked by slide `id`, parent index resolved at read time — parent-by-id LOCKED); `activeSlide`/`activeSlideRef`; `mapActiveSlide` helper; generalize `updateElement`(`:520`)/`addElement`(`:564`)/`deleteElement`(`:539`) **AND the inline duplicate (`:1100-1109`) AND the media-library insert (`:1904-1909`)**; pass panel + canvas props (body-affecting → child, chrome → parent); reset/clamp vertical index in the slide-change effect (`:455-464`), on parent delete, and in `handleUndo`(`:993`)/`handleRedo`(`:996`) (reorder is reconciliation-free under parent-by-id); add `toFlatVerticalIndex` converter. **(#12) these element callbacks were extracted into `use-element-creation` in Phase 5 — edit them there, not at the old line sites.**
- Modify: `client/src/hooks/use-clipboard.js` — replace the `getCurrentSlideIndex` (`:123`) slide resolution with an active-slide-address resolver so paste/cut/duplicate target the active child (#1).
- Modify: `client/src/hooks/use-slide-operations.js` — `addChildSlide`/`deleteChildSlide`/`duplicateChildSlide`; make `updateElements`/`deleteSelectedElements`/`group`/`ungroup`/`align` address the active child; add `currentVerticalIndex` reconciliation to the reorder/delete/duplicate paths (`:248-318`).
- Modify: `client/src/components/SlideCanvas.jsx` — accept `activeSlide` for body/elements; enumerate consumed props and keep deck-chrome props parent-derived (#14).
- Modify: `client/src/components/SlidePanel.jsx` — already supports props; ensure `onAddVerticalSlide`/select/delete/duplicate child wired (verify `:413-450`).
- Modify: `migrateSlide` in `EditorPage.jsx:131` — recurse children.
- Confirm-only (do NOT re-implement): `shared/src/htmlGenerator.js:142-157` — nested vertical `<section>` already emitted; add a lock test.
- Create: `client/src/hooks/use-slide-operations.child-slides.test.js`
- Create: `client/src/pages/__tests__/editor-page-vertical-slides.test.jsx`
- Read for context: `client/src/hooks/use-clipboard.js` (`:123`), `client/src/hooks/slide-operation-helpers.js`, `client/src/utils/slide-notes.js`, `client/src/components/animation-preview-helpers.js` (`:26` flat-`verticalIndex` example), `server/services/socket-handler.js` (`:63` flat convention), and grep `currentSlideIndex|getCurrentSlideIndex` repo-wide to enumerate ALL element writers.

## Implementation Steps

1. **Writer enumeration (do FIRST, #1):** grep `currentSlideIndex`, `currentSlideIndexRef`, `getCurrentSlideIndex` repo-wide. Produce the exhaustive list of element write paths (expect: the 3 callbacks, `updateElements`, clipboard paste/cut/dup, inline dup `:1100`, media insert `:1904`, slide-ops group/align). This list defines the `mapActiveSlide` routing surface — anything missed silently writes to the parent.
2. **RED (addressing/edit + wrong-target guard)**: `editor-page-vertical-slides.test.jsx` — seed a slide with one child; simulate `onSelectVertical({parent:0,child:0})`; assert canvas renders the child’s elements; `addElement('text')` appends to the CHILD; `updateElement`/`deleteElement` target the child; **paste (clipboard), inline-duplicate, and media-insert while the child is active ALL land on the child, not the parent**; switching back (`child:null`) targets parent. Fails.
3. **GREEN**: add `currentVerticalIndex` + `activeSlide`/`activeSlideRef` + `mapActiveSlide`; route EVERY enumerated writer through it (incl. clipboard resolver + inline dup + media insert); wire panel + canvas props (chrome stays parent).
4. **RED (child CRUD)**: `use-slide-operations.child-slides.test.js` — `addChildSlide(parentIdx)` appends child with new id + inherited bg; `duplicateChildSlide` deep-clones w/ new ids; `deleteChildSlide` removes + reconciles index. Fails.
5. **GREEN**: implement child CRUD reusing `slide-operation-helpers`.
6. **RED (migration)**: test legacy presentation with `children:[{html:'...'}]` → after `migrateSlide`, each child has `elements`. Fails (current `migrateSlide` ignores children).
7. **GREEN**: recurse `migrateSlide` into children.
8. **RED (export lock)**: shared test — presentation with vertical children → `generateRevealHTML` emits nested `<section><section>...` AND child element content is sanitized (routes through `renderText`). Since nesting already exists (`htmlGenerator.js:142-157`), this is a LOCK test, not new implementation.
9. **GREEN (export)**: confirm existing nesting passes the lock; only touch code if the sanitize-path assertion fails.
10. **RED (index reconciliation)**: tests for each stale-index trigger — (a) select child, change slide → index reset; (b) select child, delete parent → reset to `child:null`; (c) select child, **reorder/move parent** → active child FOLLOWS the slide (parent-by-id: tracked id resolves to its new position, no `undefined` activeSlide, no reset needed); (d) add child, select it, **undo past its creation** → `currentVerticalIndex.child` clamped to existing children or reset to `child:null` (also reset if the tracked parent id is gone), no crash. Fail against current code.
11. **GREEN**: implement reconciliation in the slide-change effect, parent delete, reorder paths, and `handleUndo`/`handleRedo`. Add the `toFlatVerticalIndex` converter (no consumer yet; documents the model bridge).
12. Run Phase 1 + all new tests → GREEN. Manual browser: create child, edit text, add image, **paste an element onto a child**, present (tab) shows vertical nav.

## Success Criteria

- [ ] Writer enumeration recorded; EVERY element write path (callbacks + clipboard + inline-dup + media-insert + slide-ops) routes through `mapActiveSlide`; wrong-target guard test (paste/dup/media-insert on active child) GREEN.
- [ ] Selecting a child in `SlidePanel` edits it on canvas; element CRUD + group/z-order/clipboard target the active child; deck-chrome (page-number/section/footer) stays parent-derived.
- [ ] `addChildSlide`/`deleteChildSlide`/`duplicateChildSlide` implemented + unit-tested.
- [ ] `migrateSlide` recurses children; legacy-children test GREEN.
- [ ] `generateRevealHTML` nested vertical `<section>` LOCK test GREEN (existing impl preserved); child content sanitized.
- [ ] Active parent tracked by slide `id` (parent-by-id LOCKED, Validation Session 1); `currentVerticalIndex` exposes `{parent,child}` to the panel via read-time index resolution. Reorder/move is reconciliation-free (id follows the slide); explicit reconciliation covers parent-delete + undo/redo only (no out-of-range crash, no `undefined` activeSlide).
- [ ] New editor state is NOT named `verticalIndex`; `toFlatVerticalIndex` converter + comment document the model bridge to the flat socket/export convention.
- [ ] Phase 1 characterization suite GREEN (horizontal flows unaffected).
- [ ] Browser smoke: child create → edit → paste element → present vertical nav works.

## Risk Assessment

- **Risk (Critical, now mitigated):** Un-enumerated element writers (clipboard/media/inline-dup) write to the parent while a child is active → silent data misrouting. **Mitigation:** mandatory writer-enumeration grep (step 1) + `mapActiveSlide` routing of EVERY writer + wrong-target guard test.
- **Risk (High, now mitigated):** Stale `currentVerticalIndex` after reorder/undo → `activeSlide` undefined → crash. **Mitigation:** parent-by-id LOCKED — reorder is reconciliation-free (tracked id follows the slide); reconcile on slide-change / parent-delete / undo-redo; dedicated reconciliation tests.
- **Risk (High, now mitigated):** `{parent,child}` vs flat `verticalIndex` model collision → off-by-one at live/export boundaries. **Mitigation:** distinct naming + documented `toFlatVerticalIndex` converter.
- **Risk:** Generalizing every element callback is broad-surface → regressions. **Mitigation:** centralize in one `mapActiveSlide` helper; characterization suite + new vertical tests both gate.
- **Risk:** `SlideCanvas` assumes parent-only fields (footer/page-number) children lack. **Mitigation:** enumerate props, keep chrome parent-derived (#14); page-number counts only top-level (`:1592-1602`) — confirm vertical children excluded from numbering intentionally.
- **Risk:** Export nesting breaks existing flat decks. **Mitigation:** lock test on existing impl; only nest when `children?.length`; snapshot a flat deck to prove unchanged.
- **Risk:** Scope creep (present/find-replace vertical nav). **Mitigation:** addressing model + converter are reusable but THIS phase wires editor + export only; present-tab nav is reveal-native; find-replace vertical is out of scope (note as follow-up).
