---
phase: 2
title: "Home Tab — Clipboard, Font, Paragraph, Canvas, Arrange"
status: complete
priority: P1
effort: 2d
dependencies: [1]
---

# Phase 2: Home Tab — Clipboard, Font, Paragraph, Canvas, Arrange

## Overview

Populate the Home tab with the highest-frequency editing controls: clipboard, quick insert, font formatting, paragraph alignment, canvas toggles, and arrange operations. Extract shared hooks for text formatting and selection preservation.

## Context Links

- Brainstorm Tab 1 Home: `plans/reports/brainstorm-260517-tab-based-editor-controls.md` (Tab 1 section)
- Current Toolbar Row 1: `client/src/components/Toolbar.jsx` lines 234-636
- Current Toolbar Row 2: `client/src/components/Toolbar.jsx` lines 638-1279
- Hooks: `client/src/hooks/use-clipboard.js`, `client/src/hooks/use-slide-operations.js`

## Requirements

### Functional
- **Clipboard section**: Paste, Cut, Copy, Duplicate buttons
- **Insert Quick section**: Text, Image, Shape, Chart — ONE-CLICK DEFAULT inserts (Shape inserts rectangle without gallery, Image opens URL prompt). These are shortcuts; full picker lives in Insert tab.
- **Font section**: Family select, Size select, Weight select, Bold, Italic, Underline, Strike, Text Color, Highlight
- **Paragraph section**: Alignment (L/C/R), Lists (bullet/ordered), Line Height, Clear Format
- **Canvas section**: Grid toggle, Smart Guides toggle, Rulers toggle, Zoom In/Out/Fit
- **Arrange section**: Group, Ungroup, Layer Forward/Backward/To Front/To Back

### Non-functional
- TipTap selection preserved across all text formatting interactions
- `onMouseDown` + `preventDefault()` for all text format buttons
- All icon buttons have `aria-label`
- Toggle buttons use `aria-pressed`

### Implementation Strategy Decisions
- **Selection preservation**: `savedSelectionRef` lives in `use-selection-preservation.js` hook, shared by all text format controls. Ref is created once per hook instance, passed to child controls via context or prop drilling.
- **addElement for Insert Quick**: Use same `addElement(type, overrides)` from Phase 1 extraction. Default overrides: Shape→`{shapeType: 'rect'}`, Chart→`{chartType: 'bar'}`, Text→`{}`, Image→triggers URL prompt.
- **Props threading**: Zustand selectors for state (showGrid, zoom, etc.), extracted hooks for callbacks (clipboard, formatting), grouped prop objects for ribbon sections.

## Architecture

```
HomeTabContent
├── RibbonSection label="Clipboard"
│   ├── PasteButton (large)
│   └── CutCopyDuplicateGroup
├── RibbonSection label="Insert Quick"
│   ├── TextButton, ImageButton, ShapeButton, ChartButton
├── RibbonSection label="Font"
│   ├── FontFamilySelect, FontSizeSelect, FontWeightSelect
│   ├── BoldItalicUnderlineStrikeGroup
│   └── TextColorButton, HighlightColorButton
├── RibbonSection label="Paragraph"
│   ├── AlignmentGroup (L/C/R)
│   ├── ListGroup (bullet/ordered)
│   ├── LineHeightSelect, ClearFormatButton
├── RibbonSection label="Canvas"
│   ├── GridToggle, SmartGuidesToggle, RulersToggle
│   └── ZoomInButton, ZoomOutButton, ZoomFitButton
├── RibbonSection label="Arrange"
│   ├── GroupButton, UngroupButton
│   └── LayerGroup (Forward/Backward/Front/Back)
```

## Related Code Files

### Create
- `client/src/hooks/use-text-formatting.js` (~80 LOC)
- `client/src/hooks/use-selection-preservation.js` (~40 LOC)
- `client/src/components/ribbon/HomeTabContent.jsx` (~180 LOC)
- `client/src/components/ribbon/controls/ClipboardButtons.jsx` (~40 LOC)
- `client/src/components/ribbon/controls/FontControls.jsx` (~100 LOC)
- `client/src/components/ribbon/controls/ParagraphControls.jsx` (~60 LOC)
- `client/src/components/ribbon/controls/CanvasControls.jsx` (~50 LOC)
- `client/src/components/ribbon/controls/ArrangeControls.jsx` (~50 LOC)

### Modify
- `client/src/components/ribbon/RibbonShell.jsx` — pass props to HomeTabContent
- `client/src/pages/EditorPage.jsx` — extract useElementInsertion hook

### Read for context
- `client/src/components/Toolbar.jsx` — TipTap selection preservation pattern (lines 149-183)
- `client/src/extensions/FontFamily.js`, `FontSize.js`, `tiptap-font-weight-extension.js`
- `client/src/stores/editor-store.js` — canvas toggle state

## Tests Before (Regression Coverage)

1. **Clipboard operations work via Toolbar**
   - Copy/paste/duplicate elements
   - Cut removes element

2. **Text formatting works via Toolbar Row 2**
   - Bold/Italic/Underline/Strikethrough toggle
   - Font family/size/weight change
   - Text color/highlight change
   - Alignment change
   - List toggle

3. **Canvas controls work via Toolbar Row 1**
   - Grid toggle changes editor-store.showGrid
   - Smart guides toggle changes editor-store.smartGuidesEnabled
   - Rulers toggle changes editor-store.showRulers

4. **Arrange operations work**
   - Group/ungroup selected elements
   - Bring forward/send backward

```js
// client/src/components/ribbon/home-tab-content.test.jsx
describe('HomeTabContent', () => {
  describe('Clipboard section', () => {
    it('renders Paste, Cut, Copy, Duplicate buttons', () => { ... })
    it('calls handlePaste on Paste click', () => { ... })
  })
  describe('Font section', () => {
    it('renders font family select with 18 options', () => { ... })
    it('calls editor.chain().focus().toggleBold() on Bold mousedown', () => { ... })
    it('uses onMouseDown not onClick for text formatting', () => { ... })
  })
  describe('Canvas section', () => {
    it('has aria-pressed on Grid toggle matching showGrid state', () => { ... })
    it('calls toggleGrid on click', () => { ... })
  })
  describe('Arrange section', () => {
    it('renders Group/Ungroup when selectedCount >= 2', () => { ... })
    it('hides Group/Ungroup when selectedCount < 2', () => { ... })
  })
})
```

## Implementation Steps

1. Create `use-selection-preservation.js` hook — extract `rememberSelection`, `getSelectionChain`, `handleTextCommandMouseDown` from Toolbar.jsx
2. Create `use-text-formatting.js` hook — wraps TipTap commands for bold/italic/color/etc
3. `use-element-insertion.js` hook already extracted in Phase 1 Step 11 — reuse here
4. Create `ClipboardButtons.jsx` — Paste(large), Cut, Copy, Duplicate
5. Create `FontControls.jsx` — Family, Size, Weight selects + B/I/U/S toggles + Color/Highlight
6. Create `ParagraphControls.jsx` — Alignment, Lists, Line Height, Clear Format
7. Create `CanvasControls.jsx` — Grid, SmartGuides, Rulers toggles + Zoom buttons
8. Create `ArrangeControls.jsx` — Group/Ungroup + Layer buttons
9. Populate `HomeTabContent.jsx` — compose all sections
10. Wire props from EditorPage to HomeTabContent via RibbonShell

## Tests After (New Behavior)

1. **All Home tab controls render**
   - 6 sections with correct labels
   - All buttons have aria-label
   - Toggle buttons have aria-pressed

2. **Clipboard works via ribbon**
   - Copy/paste/duplicate elements
   - Same behavior as old Toolbar

3. **Text formatting preserves selection**
   - Bold via ribbon preserves text selection
   - Color picker via ribbon preserves selection
   - Font family change preserves selection

4. **Canvas toggles work via ribbon**
   - Grid/SmartGuides/Rulers toggles sync with editor-store

5. **Arrange works via ribbon**
   - Group/ungroup with 2+ selected elements
   - Layer ordering works

6. **Tab switch selection preservation**
   - Select text in canvas → switch to Insert tab → switch back to Home → click Bold → selection preserved
   - This validates the `savedSelectionRef` pattern survives tab switches

## Regression Gate

```bash
npm run lint
npm run build
npm run test
```

Old Toolbar still works when `useRibbon=false`. Ribbon Home tab matches old Toolbar functionality.

## Success Criteria

- [ ] All 6 Home tab sections render
- [ ] Clipboard operations work
- [ ] Text formatting preserves TipTap selection
- [ ] Canvas toggles sync with editor-store
- [ ] Arrange operations work
- [ ] All tests pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| TipTap selection lost on ribbon click | `onMouseDown` + `preventDefault()` pattern |
| Font controls duplicate Toolbar logic | Shared `useTextFormatting` hook |
| Color picker steals focus | `savedSelectionRef` restore on popover close |

## Next Steps

Phase 3: Insert tab — element galleries from InsertMenu.
