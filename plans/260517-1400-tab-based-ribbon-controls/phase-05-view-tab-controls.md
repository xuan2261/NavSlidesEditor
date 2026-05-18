---
phase: 5
title: "View Tab — Views, Show, Zoom, Find"
status: complete
priority: P2
effort: 1d
dependencies: [1]
---

# Phase 5: View Tab — Views, Show, Zoom, Find

## Overview

Create the View tab absorbing View menu items and display toggles: view modes/actions (Normal, Slide Sorter, Speaker Notes focus), show toggles (Grid, Rulers, Guides, Page Numbers), zoom controls, and find/replace + command palette.

## Context Links

- Current View menu: `client/src/components/EditorMenuBar.jsx` lines 100-150
- Zoom controls: `client/src/components/canvas/canvas-floating-zoom-in-out-fit-controls.jsx`
- Canvas toggles: `client/src/stores/editor-store.js`

## Requirements

### Functional
- **Views section**: Normal, Slide Sorter buttons, plus Speaker Notes action. Final decision: Speaker Notes is a button action that scrolls/focuses the existing notes textarea. Current `editor-store.viewMode` only supports `normal | sorter`; do not add `viewMode='notes'` in this migration.
- **Show section**: Grid toggle, Rulers toggle, Guides toggle (Page Numbers is in Design > Footer, not here)
- **Zoom section**: Zoom In, Zoom Out, Fit, percentage dropdown (25/50/75/100/150/200/400%)
- **Find section**: Find & Replace button, Command Palette button

### Non-functional
- Toggle buttons use `aria-pressed`
- Zoom percentage displayed as label
- View mode buttons show active state

## Architecture

```
ViewTabContent
├── RibbonSection label="Views"
│   ├── NormalButton, SlideSorterButton, SpeakerNotesFocusButton
├── RibbonSection label="Show"
│   ├── GridToggle, RulersToggle, GuidesToggle
├── RibbonSection label="Zoom"
│   ├── ZoomInButton, ZoomOutButton, ZoomFitButton
│   └── ZoomPercentageDropdown (25/50/75/100/150/200/400%)
├── RibbonSection label="Find"
│   ├── FindReplaceButton, CommandPaletteButton
```

## Related Code Files

### Create
- `client/src/components/ribbon/ViewTabContent.jsx` (~100 LOC)
- `client/src/components/ribbon/controls/ViewModeButtons.jsx` (~40 LOC)
- `client/src/components/ribbon/controls/ShowToggles.jsx` (~40 LOC)
- `client/src/components/ribbon/controls/ZoomControls.jsx` (~50 LOC)
- `client/src/components/ribbon/controls/FindButtons.jsx` (~30 LOC)

### Read for context
- `client/src/stores/editor-store.js` — showGrid, showRulers, showFindReplace, viewMode, zoom
- `client/src/components/canvas/canvas-floating-zoom-in-out-fit-controls.jsx` — zoom presets

## Tests Before (Regression Coverage)

1. **View mode switching works**
   - Normal view shows SlideCanvas
   - Slide Sorter shows thumbnail grid
   - Speaker Notes opens notes panel

2. **Canvas toggles work**
   - Grid toggle changes showGrid
   - Rulers toggle changes showRulers

3. **Zoom works**
   - Zoom in/out changes zoom state
   - Fit resets to 100%

4. **Find/Replace opens**
   - Ctrl+F opens FindReplaceBar

```js
// client/src/components/ribbon/view-tab-content.test.jsx
describe('ViewTabContent', () => {
  describe('Views section', () => {
    it('renders Normal, Slide Sorter, Speaker Notes buttons', () => { ... })
    it('highlights active view mode', () => { ... })
  })
  describe('Show section', () => {
    it('renders Grid, Rulers, Guides toggles (Page Numbers in Design > Footer only)', () => { ... })
    it('has aria-pressed matching store state', () => { ... })
  })
  describe('Zoom section', () => {
    it('renders Zoom In, Out, Fit buttons', () => { ... })
    it('renders percentage dropdown with 7 presets', () => { ... })
    it('displays current zoom percentage', () => { ... })
  })
  describe('Find section', () => {
    it('renders Find & Replace button', () => { ... })
    it('renders Command Palette button', () => { ... })
  })
})
```

## Implementation Steps

1. Create `ViewModeButtons.jsx` — Normal, Slide Sorter, Speaker Notes focus action
2. Create `ShowToggles.jsx` — Grid, Rulers, Guides
3. Create `ZoomControls.jsx` — In/Out/Fit + percentage dropdown
4. Create `FindButtons.jsx` — Find & Replace, Command Palette
5. Create `ViewTabContent.jsx` — compose all sections

## Tests After (New Behavior)

1. **View mode buttons work**
   - Switch between Normal/Sorter
   - Speaker Notes button focuses/scrolls the existing notes textarea
   - Active state highlighted

2. **Show toggles work**
   - All 3 toggles sync with editor-store

3. **Zoom controls work**
   - In/Out/Fit functional
   - Percentage dropdown sets zoom

4. **Find buttons work**
   - Opens FindReplaceBar
   - Opens CommandPalette

## Regression Gate

```bash
npm run test
```

View modes, toggles, zoom, find all work via ribbon.

## Success Criteria

- [ ] 4 sections render
- [ ] View mode switching works
- [ ] Show toggles sync with store
- [ ] Zoom controls functional
- [ ] Find/replace opens
- [ ] All tests pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Speaker Notes opens different view | Route to same component as EditorMenuBar |
| Zoom state sync | Read/write from editor-store directly |

## Next Steps

Phase 6: Transitions tab.
