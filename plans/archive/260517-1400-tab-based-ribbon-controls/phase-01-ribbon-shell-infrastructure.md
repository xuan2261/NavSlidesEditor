---
phase: 1
title: "Ribbon Shell & Tab Infrastructure"
status: completed
priority: P1
effort: 2d
dependencies: []
---

# Phase 1: Ribbon Shell & Tab Infrastructure

## Overview

Create the RibbonShell component with TabBar, wire to Zustand state, install Radix UI Tabs, and integrate into EditorPage behind a feature flag. Old Toolbar remains fully functional.

## Context Links

- Brainstorm: `plans/reports/brainstorm-260517-tab-based-editor-controls.md`
- Research: `plans/260517-1400-tab-based-ribbon-controls/research/researcher-ribbon-ui-patterns.md`
- Scout: `plans/260517-1400-tab-based-ribbon-controls/reports/editor-ribbon-codebase-scout-report.md`

## Requirements

### Functional
- RibbonShell renders 7 tabs: Home, Insert, Design, Format, Transitions, Animations, View
- Tab bar with horizontal scroll on small viewports
- Active tab stored in ui-store.js, persisted to localStorage
- Feature flag `useRibbon` in ui-store.js toggles between old Toolbar and RibbonShell
- `Ctrl+Alt+R` dev shortcut toggles ribbon on/off (NOT Ctrl+Shift+R — that's browser hard refresh, not capturable)
- File dropdown (left of tabs) with Open, Export, Publish, History groups
- AI/Share/Present buttons on right side of header
- Explicit integration contract: current `EditorPage.jsx` has `EditorMenuBar` in the top header and `Toolbar` above `SlideCanvas`. Phase 1 must implement the ribbon as two coordinated surfaces:
  - `RibbonHeaderBar` replaces `EditorMenuBar` when `useRibbon=true` and owns File/actions/tabs.
  - `RibbonPanel` replaces `Toolbar` when `useRibbon=true` and owns active tab content above `SlideCanvas`.
  - Both read/write the same `ui-store.activeTab`.

### Non-functional
- ARIA: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`
- Keyboard: Left/Right arrows, Home/End, Enter/Space
- Responsive: horizontal scroll at <768px, icon-only at 768-1024px
- Ribbon height: ~36px tab bar + ~60-80px content = ~100-120px total

## Architecture

```
EditorPage
├── Header (Back, Title, QuickAccessToolbar, [RibbonHeaderBar OR EditorMenuBar])
├── Body
│   ├── SlidePanel
│   ├── Center
│   │   ├── [RibbonPanel tab content OR Toolbar]
│   │   └── SlideCanvas
│   └── PropertiesPanel
```

RibbonShell structure:
```
RibbonShell
├── RibbonHeaderBar (7 tab triggers + File dropdown + AI/Share/Present)
├── RibbonPanel (renders active tab panel)
│   ├── HomeTabContent (empty in Phase 1)
│   ├── InsertTabContent (empty)
│   ├── DesignTabContent (empty)
│   ├── FormatTabContent (empty)
│   ├── TransitionsTabContent (empty)
│   ├── AnimationsTabContent (empty)
│   └── ViewTabContent (empty)
```

## Related Code Files

### Create
- `client/src/components/ribbon/RibbonShell.jsx` (~80 LOC)
- `client/src/components/ribbon/RibbonHeaderBar.jsx` (~80 LOC)
- `client/src/components/ribbon/RibbonPanel.jsx` (~80 LOC)
- `client/src/components/ribbon/TabBar.jsx` (~60 LOC)
- `client/src/components/ribbon/ribbon-tabs-config.js` (~30 LOC)
- `client/src/components/ribbon/RibbonSection.jsx` (~25 LOC)
- `client/src/hooks/use-element-insertion.js` (~250 LOC, extracted from EditorPage.jsx lines 524-776)
- `client/src/components/ribbon/HomeTabContent.jsx` (~10 LOC, empty shell)
- `client/src/components/ribbon/InsertTabContent.jsx` (~10 LOC, empty shell)
- `client/src/components/ribbon/DesignTabContent.jsx` (~10 LOC, empty shell)
- `client/src/components/ribbon/FormatTabContent.jsx` (~10 LOC, empty shell)
- `client/src/components/ribbon/TransitionsTabContent.jsx` (~10 LOC, empty shell)
- `client/src/components/ribbon/AnimationsTabContent.jsx` (~10 LOC, empty shell)
- `client/src/components/ribbon/ViewTabContent.jsx` (~10 LOC, empty shell)

### Modify
- `client/src/stores/ui-store.js` — add `activeTab`, `setActiveTab`, `useRibbon`, `setUseRibbon`
- `client/src/pages/EditorPage.jsx` — conditional render RibbonShell vs old Toolbar/EditorMenuBar

## Tests Before (Regression Coverage)

Write these tests BEFORE any code changes:

1. **EditorPage renders Toolbar by default**
   - Verify Toolbar component renders when `useRibbon` is false
   - Verify EditorMenuBar renders in header

2. **EditorPage renders all existing controls**
   - InsertMenu button visible
   - Grid toggle visible
   - Smart guides toggle visible
   - Font controls visible when editing text

3. **Keyboard shortcuts work**
   - Ctrl+Z triggers undo
   - Ctrl+C/X/V triggers clipboard
   - Ctrl+F opens find/replace

```js
// client/src/components/ribbon/ribbon-shell.test.jsx
describe('RibbonShell', () => {
  it('renders 7 tab triggers', () => { ... })
  it('has role="tablist" on tab bar', () => { ... })
  it('has role="tab" on each trigger', () => { ... })
  it('has role="tabpanel" on content area', () => { ... })
  it('activates Home tab by default', () => { ... })
  it('switches tab on click', () => { ... })
  it('navigates tabs with Left/Right arrows', () => { ... })
  it('has aria-selected on active tab', () => { ... })
})
```

## Implementation Steps

1. Install `@radix-ui/react-tabs` in the client workspace: `npm install @radix-ui/react-tabs --workspace=client`
2. Create `ribbon-tabs-config.js` with tab definitions (id, label, icon)
3. Create `RibbonSection.jsx` — section wrapper with label + separator
4. Create `TabBar.jsx` — renders 7 tab triggers using Radix TabsList
5. Create 7 empty tab content components (shells)
6. Create `RibbonHeaderBar.jsx`, `RibbonPanel.jsx`, and `RibbonShell.jsx` shared composition/test harness
7. Update `ui-store.js` — add `activeTab`, `setActiveTab`, `useRibbon`, `setUseRibbon`
8. Update `EditorPage.jsx` — conditional render `{useRibbon ? <RibbonHeaderBar/> : <EditorMenuBar/>}` in header and `{useRibbon ? <RibbonPanel/> : <Toolbar/>}` above canvas
9. Add `Ctrl+Alt+R` shortcut to toggle ribbon in useKeyboard handler (NOT Ctrl+Shift+R — browser hard refresh)
10. Add localStorage persistence for activeTab (key: `navslides-ribbon-active-tab`)
11. Extract `use-element-insertion.js` hook from EditorPage.jsx (lines 524-776) — shared infrastructure for Phase 2+3

## Tests After (New Behavior)

1. **RibbonShell renders correctly**
   - 7 tab triggers with correct labels
   - Tab switching works
   - Active tab persists across re-renders

2. **Feature flag works**
   - `useRibbon=false` shows old Toolbar
   - `useRibbon=true` shows RibbonShell
   - `Ctrl+Alt+R` toggles

3. **Accessibility**
   - All ARIA roles present
   - Keyboard navigation works
   - Focus visible ring on tabs

## Regression Gate

```bash
npm run lint
npm run build
npm run test
```

All tests pass. Old Toolbar works identically when `useRibbon=false`.

## Success Criteria

- [x] RibbonShell renders with 7 tabs
- [x] Tab switching works (click + keyboard)
- [x] Feature flag toggles old/new UI
- [x] ARIA contract met
- [x] Old Toolbar unaffected
- [x] All tests pass

## Completion Notes

- Completed on 2026-05-17.
- Implemented the required two-surface integration: `RibbonHeaderBar` replaces `EditorMenuBar` in the header and `RibbonPanel` replaces `Toolbar` above `SlideCanvas` when `useRibbon=true`.
- `Ctrl+Alt+R` toggles `useRibbon` through the shortcut registry and `useKeyboard`.
- `activeTab` remains centralized in `ui-store.js` and persists to `localStorage`.
- Added explicit tab/panel ARIA ids so header tabs and body panels remain associated across the split layout.
- Fixed ribbon arrange stack-edge actions so Bring to front / Send to back normalize z-index order instead of moving one step.
- Verification passed: `npm run lint`, `npm run build`, `npm run test` (127 files / 1127 tests).
- `use-element-insertion.js` extraction was not performed in this slice; current ribbon content uses existing `EditorPage` callbacks directly. Revisit during Phase 2/3 cleanup if callback duplication grows.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Radix UI adds bundle size | Radix is tree-shakeable, only Tabs imported |
| Tab switch blurs TipTap | Phase 1 has no text controls — addressed in Phase 2 |
| Ribbon height reduces canvas | Fixed height, responsive breakpoints |

## Next Steps

Phase 2: Populate Home tab with clipboard, font, paragraph, canvas, arrange controls.
