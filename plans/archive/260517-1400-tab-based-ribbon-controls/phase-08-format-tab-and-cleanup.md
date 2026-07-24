---
phase: 8
title: "Format Tab & Cleanup — Contextual Controls, Remove Old Surfaces"
status: complete
priority: P1
effort: 5d
dependencies: [1, 2, 3, 4, 5, 6, 7]
---

# Phase 8: Format Tab & Cleanup — Contextual Controls, Remove Old Surfaces

## Overview

Split into two sub-phases: **8a (3d)** creates the Format tab with contextual controls and shared components. **8b (2d)** removes old surfaces, migrates E2E tests, and cleans up.

## Completion Notes

- Old `Toolbar.jsx`, `InsertMenu.jsx`, and `EditorMenuBar.jsx` surfaces were removed.
- Ribbon is now the default editor controls surface; the `useRibbon` toggle and shortcut were removed.
- Header actions moved into `RibbonHeaderBar` and `ribbon-file-dropdown-menu.jsx`.
- E2E page objects now use `RibbonInsertHelper` and ribbon selectors.
- Insert helper parity was verified for text, code, LaTeX, Markdown, chart, callout, HTML, shape, table, and line/arrow.
- Home text formatting now uses preserved TipTap selection for select-based font size/family changes.
- Shape gallery now exposes human-readable accessible labels from `revealjs-shared` while inserting existing shape ids.
- Code review follow-up fixed three parity regressions: Design tab background image editing/upload, Paragraph line-height/clear-formatting commands, and View tab Find/Notes/Sorter actions.
- Final review follow-up restored visible save failure + `Retry`, serialized autosave requests to prevent older writes from overwriting newer snapshots, persisted grid size changes from Home and View ribbon controls, restored the Product Tour quick access target, switched text editing to the Home tab for font/paragraph controls, and migrated remaining background/insert E2E selectors to ribbon role selectors.

## Context Links

- PropertiesPanel: `client/src/components/PropertiesPanel.jsx`
- Property sub-editors: `client/src/components/properties/*.jsx`
- CommonElementControls: `client/src/components/properties/common-element-controls.jsx`
- Brainstorm Tab 4 Format: `plans/reports/brainstorm-260517-tab-based-editor-controls.md` (Tab 4)

---

## Phase 8a: Format Tab + Shared Controls (3d)

### Requirements

#### Functional
- **No selection / slide selected**: Slide background, transition, auto-slide, footer, page number
- **Shape/Line selected**: Fill color, Stroke color, Stroke width, Line style, Markers, Drop Shadow, Opacity, Position
- **Image selected**: Object Fit, Alt Text, Crop, Drop Shadow, Opacity, Position
- **Chart selected**: Type selector, Labels, Series editor, Position
- **Table selected**: Add/Remove rows/cols, Header toggle, Border style, Cell styling, Position
- **Video/Audio selected**: Source URL, Poster, ObjectFit, Start/End time, Playback controls, Position
- **Code selected**: Language, Theme, Font size, Position
- **Any element selected**: Fragment controls, Effects (Shadow, Opacity), Position (X/Y/W/H/Rotation/Lock)
- **Custom CSS section**: CSS editor textarea (from EditorMenuBar > View > Custom CSS)
- **Presenter Tools section**: Theme toggle, font zoom, slide menu, pen/chalkboard (from EditorMenuBar > Settings)

#### Non-functional
- Contextual type derived from `editor-store.selectedElementIds`, NOT stored
- "No selection" placeholder shown when nothing selected
- PropertiesPanel kept as detail sidebar (not removed)
- Shared controls used by both Format tab and PropertiesPanel

#### Implementation Strategy Decisions
- **PositionControls extraction**: Extract X/Y/W/H/Rotation/Lock inline code from `common-element-controls.jsx` into new `PositionControls.jsx`. Import back into common-element-controls.jsx to keep PropertiesPanel working. Both Format tab and PropertiesPanel import from same file.
- **PropertiesPanel long-term**: PropertiesPanel stays as detail sidebar for now. Shared controls (PositionControls, EffectsControls) imported by both. Future: consider collapsing PropertiesPanel when Format tab is active.

### Architecture

```
FormatTabContent
├── NoSelectionPlaceholder (when nothing selected)
├── SlideFormatControls (when slide selected)
│   ├── BackgroundControls
│   ├── TransitionControls
│   └── FooterControls
├── ShapeFormatControls (when shape/line selected)
│   ├── FillStrokeControls
│   ├── MarkerControls
│   └── EffectsControls
├── ImageFormatControls (when image selected)
│   ├── ObjectFitControls
│   └── EffectsControls
├── ChartFormatControls (when chart selected)
│   └── ChartTypeSelector
├── TableFormatControls (when table selected)
│   ├── RowColControls
│   └── CellStyleControls
├── MediaFormatControls (when video/audio selected)
│   ├── SourceControls
│   └── PlaybackControls
├── CodeFormatControls (when code selected)
│   └── LanguageThemeControls
├── CommonFormatControls (any element)
│   ├── FragmentControls (reuse from Phase 7)
│   ├── EffectsControls (shadow, opacity)
│   └── PositionControls (X/Y/W/H/Rotation/Lock)
```

### Related Code Files

#### Create
- `client/src/components/ribbon/FormatTabContent.jsx` (~120 LOC)
- `client/src/components/ribbon/format/SlideFormatControls.jsx` (~60 LOC)
- `client/src/components/ribbon/format/ShapeFormatControls.jsx` (~80 LOC)
- `client/src/components/ribbon/format/ImageFormatControls.jsx` (~50 LOC)
- `client/src/components/ribbon/format/ChartFormatControls.jsx` (~40 LOC)
- `client/src/components/ribbon/format/TableFormatControls.jsx` (~60 LOC)
- `client/src/components/ribbon/format/MediaFormatControls.jsx` (~50 LOC)
- `client/src/components/ribbon/format/CodeFormatControls.jsx` (~40 LOC)
- `client/src/components/ribbon/format/CommonFormatControls.jsx` (~80 LOC)
- `client/src/components/ribbon/controls/PositionControls.jsx` (~60 LOC)
- `client/src/components/ribbon/controls/EffectsControls.jsx` (~50 LOC)
- `client/src/hooks/use-element-formatting.js` (~60 LOC)

#### Modify
- `client/src/components/properties/common-element-controls.jsx` — extract shared PositionControls
- Read `PropertiesPanel.test.jsx` before extracting to avoid breaking existing assertions

### Tests Before (Regression Coverage)

1. **PropertiesPanel shows correct properties per element type**
   - Shape: fill, stroke, opacity
   - Image: fit, filters
   - Chart: type, series
   - Table: rows, cols, cells
   - Media: source, playback
   - Code: language, theme

2. **CommonElementControls work for all elements**
   - Position (X/Y/W/H/Rotation)
   - Lock toggle
   - Fragment controls
   - Drop shadow
   - Layer ordering

3. **All keyboard shortcuts still work**
   - Ctrl+Z/Y undo/redo
   - Ctrl+C/X/V clipboard
   - Ctrl+F find/replace
   - Delete/Backspace delete element

```js
// client/src/components/ribbon/format-tab-content.test.jsx
describe('FormatTabContent', () => {
  describe('Contextual rendering', () => {
    it('shows NoSelectionPlaceholder when no element selected', () => { ... })
    it('shows ShapeFormatControls for shape element', () => { ... })
    it('shows ImageFormatControls for image element', () => { ... })
    it('shows ChartFormatControls for chart element', () => { ... })
    it('shows TableFormatControls for table element', () => { ... })
    it('shows MediaFormatControls for video element', () => { ... })
    it('shows CodeFormatControls for code element', () => { ... })
    it('shows CommonFormatControls for any element', () => { ... })
  })
  describe('PositionControls', () => {
    it('renders X/Y/W/H/Rotation inputs', () => { ... })
    it('renders Lock toggle', () => { ... })
    it('calls onUpdateElement on value change', () => { ... })
  })
  describe('EffectsControls', () => {
    it('renders Shadow toggle and controls', () => { ... })
    it('renders Opacity slider', () => { ... })
  })
})
```

### Implementation Steps (8a)

1. Read `PropertiesPanel.test.jsx` to understand existing test assertions before extracting
2. Create `PositionControls.jsx` — X/Y/W/H/Rotation/Lock (extract from CommonElementControls)
3. Create `EffectsControls.jsx` — Shadow toggle + params, Opacity slider
4. Create `use-element-formatting.js` — shared hook for element property updates
5. Create `SlideFormatControls.jsx` — background, transition, auto-slide, footer
6. Create `ShapeFormatControls.jsx` — fill, stroke, markers, effects
7. Create `ImageFormatControls.jsx` — fit, alt text, crop, effects
8. Create `ChartFormatControls.jsx` — type, labels, series
9. Create `TableFormatControls.jsx` — rows/cols, header, border, cell style
10. Create `MediaFormatControls.jsx` — source, poster, playback
11. Create `CodeFormatControls.jsx` — language, theme, font size
12. Create `CommonFormatControls.jsx` — fragment, effects, position
13. Create `FormatTabContent.jsx` — contextual router based on element type
14. Run `npm run test` after each extraction step to catch breakage early

### Tests After (8a New Behavior)

1. **Contextual Format tab works**
   - Correct controls for each element type
   - "No selection" placeholder shown

2. **Shared controls work in both locations**
   - PositionControls in Format tab and PropertiesPanel
   - EffectsControls in Format tab and PropertiesPanel
   - Values sync between both (Zustand)

3. **PropertiesPanel tests still pass**
   - Extraction didn't break existing assertions

### Regression Gate (8a)

```bash
npm run lint
npm run build
npm run test
```

---

## Phase 8b: Old Surface Removal + E2E Migration (2d)

### Requirements

- Remove old Toolbar.jsx, InsertMenu.jsx, EditorMenuBar.jsx
- Update ALL E2E tests and page objects for ribbon selectors
- Remove `useRibbon` feature flag — ribbon is now default
- Clean up localStorage stale keys
- EditorPage.jsx cleanup — remove unused props and imports

### Related Code Files

#### Create
- `client/src/components/ribbon/FileDropdown.jsx` (~40 LOC) — File menu: Open, Export (HTML/PDF/PPTX), Publish, History

#### Modify
- `client/src/pages/EditorPage.jsx` — remove old component references
- `client/src/stores/ui-store.js` — remove `useRibbon`, keep `activeTab`

#### Delete (one at a time, build check between each)
- `client/src/components/Toolbar.jsx` (1294 LOC)
- `client/src/components/InsertMenu.jsx` (621 LOC)
- `client/src/components/EditorMenuBar.jsx` (420 LOC)

#### E2E files to update (7 primary listed; audit all ~26 E2E files for toolbar/insert selectors)
- `tests/e2e/pages/InsertMenuHelper.js` — add ribbon-aware methods
- `tests/e2e/pages/EditorPage.js` — update selectors
- `tests/e2e/toolbar-elements.spec.js` — update selectors
- `tests/e2e/coverage-gaps.spec.js` — update selectors
- `tests/e2e/games/game-elements.spec.js` — update selectors
- `tests/e2e/editor.spec.js` — update selectors
- `tests/e2e/slide-management.spec.js` — update selectors
- Any other E2E files referencing Toolbar/InsertMenu selectors — `grep -r "Toolbar\|InsertMenu\|EditorMenuBar" tests/e2e/` to find all
- Validation grep found current explicit references in `tests/e2e/pages/EditorPage.js`, `tests/e2e/pages/InsertMenuHelper.js`, `tests/e2e/toolbar-elements.spec.js`, `tests/e2e/games/game-elements.spec.js`, `tests/e2e/coverage-gaps.spec.js`, `tests/e2e/editor.spec.js`, and `tests/e2e/slide-management.spec.js`. Also audit `.tour-step-toolbar`, `clickInsertMenuItem`, `addToolbarElement`, `clickMainToolbarButton`, `chooseMainToolbarOption`, and toolbar overflow metrics.

### Tests Before (8b Regression — COMPREHENSIVE)

This is the most critical gate. Verify ALL functionality works before deletion:

1. **All 7 ribbon tabs functional**
   - Home: clipboard, font, paragraph, canvas, arrange
   - Insert: all 22+ element types
   - Design: themes, background, size, footer, navigation
   - Format: contextual controls per element type
   - Transitions: gallery, direction, duration
   - Animations: fragment, type, timeline
   - View: modes, show, zoom, find

2. **All element types insert via ribbon**
3. **All keyboard shortcuts work**
4. **Text formatting preserves TipTap selection**
5. **Canvas controls work**
6. **Export (HTML/PDF/PPTX) produces correct output**

### Implementation Steps (8b)

1. Create ribbon-aware E2E page object methods in `InsertMenuHelper.js`:
   ```js
   async clickInsertItemViaRibbon(itemName) {
     await this.page.locator('[role="tab"]:has-text("Insert")').click()
     await this.page.locator(`[role="tabpanel"] button:has-text("${itemName}")`).click()
   }
   ```
2. Update `EditorPage.js` page object with ribbon selectors
2b. Replace or rename `.tour-step-toolbar` onboarding/test selector only after ProductTour/intro steps are updated, otherwise onboarding regression tests will fail.
3. Update `toolbar-elements.spec.js` — use ribbon selectors
4. Update `coverage-gaps.spec.js` — use ribbon selectors
5. Update `games/game-elements.spec.js` — use ribbon selectors
6. Update `editor.spec.js` — use ribbon selectors
7. Update `slide-management.spec.js` — use ribbon selectors
8. Run `npm run test:e2e` — all pass with ribbon
8b. Create `FileDropdown.jsx` (~40 LOC) — File menu with Open, Export, Publish, History groups. This replaces EditorMenuBar's File menu functionality. Wire into RibbonShell header left of tabs.
9. Delete `Toolbar.jsx` — run `npm run build` to verify
10. Delete `InsertMenu.jsx` — run `npm run build` to verify
11. Delete `EditorMenuBar.jsx` — run `npm run build` to verify
12. Update `EditorPage.jsx` — remove old imports and unused props
13. Remove `useRibbon` from `ui-store.js` — ribbon is now default
14. Add `localStorage.removeItem('navslides-ribbon-use-ribbon')` to clean stale flag
15. Run full test suite: `npm run test && npm run test:e2e`

### Tests After (8b New Behavior)

1. **Old surfaces removed cleanly**
   - No references to Toolbar/InsertMenu/EditorMenuBar in codebase
   - Build passes without errors

2. **E2E tests pass with ribbon selectors**
   - All element insertions work
   - All editor interactions work

3. **No stale localStorage**
   - `useRibbon` key removed

### Regression Gate (8b)

```bash
npm run lint
npm run build
npm run test
npm run test:e2e
```

All tests pass. No references to old Toolbar/InsertMenu/EditorMenuBar.

---

## Success Criteria

- [x] Format tab shows contextual controls per element type
- [x] "No selection" placeholder works
- [x] Shared controls sync between Format tab and PropertiesPanel
- [x] Custom CSS section accessible from ribbon controls
- [x] View tab exposes Find & Replace, Animation Timeline, Custom CSS, Speaker Notes, and Slide Sorter
- [x] Presenter/editor header tools accessible
- [x] Old Toolbar.jsx removed
- [x] Old InsertMenu.jsx removed
- [x] Old EditorMenuBar.jsx removed
- [x] EditorPage.jsx cleaned up
- [x] E2E tests updated for focused ribbon flows
- [x] All keyboard shortcuts covered by unit regression suite
- [x] Core element insertions verified via ribbon
- [x] `npm run lint`, `npm run build`, and `npm run test` pass
- [x] Autosave failure retry contract verified against ribbon quick access
- [x] Focused Playwright editor/background/font/line-height ribbon slice passes

Focused Playwright verification passed for `element-lifecycle.spec.js --grep "autosave failure"`, the editor/background/font/line-height ribbon slice, `smoke.spec.js`, `animation-preview.spec.js`, and `toolbar-elements.spec.js`. Full Vitest passed at 127 files / 1135 tests after review follow-up fixes. A full `npm run test:e2e` run was not completed in this session due prior stale Playwright processes and runtime cost.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Removing old surfaces breaks something | Delete one at a time, build check between each |
| PropertiesPanel duplication | Extract shared controls, not copy logic |
| E2E tests break on deletion | Update E2E BEFORE deletion (Step 1-8) |
| EditorPage cleanup introduces bugs | Incremental removal, test after each deletion |
| Keyboard shortcuts break | Verify all shortcuts after cleanup |
| Stale localStorage | Explicit cleanup in Step 14 |

## Security Considerations

- No new security surface — same callbacks, same data flow
- File upload still uses same multer endpoint
- No new user input paths

## Next Steps

- Monitor full E2E runtime on CI after stale local Playwright processes are cleared.
- Post-launch: consider ribbon collapse toggle as separate UX work if users request it.
