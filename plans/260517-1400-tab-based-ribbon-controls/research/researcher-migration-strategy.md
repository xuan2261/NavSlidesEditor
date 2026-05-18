# Research Report: Incremental Migration Strategy

**Date:** 2026-05-17
**Researcher:** researcher-migration

## 1. Feature Flag Pattern

**Recommendation: Zustand boolean in ui-store.js, conditional rendering. NOT CSS hiding.**

Why not CSS hiding:
- Both Toolbar and RibbonShell mount → doubled TipTap event subscriptions
- `savedSelectionRef` competition between old/new
- Focus management bugs

Pattern:
```js
// ui-store.js
useRibbon: false,
setUseRibbon: (v) => set({ useRibbon: v }),

// EditorPage.jsx
{useRibbon ? <RibbonShell ... /> : <Toolbar ... />}
```

Dev toggle: `Ctrl+Shift+R` keyboard shortcut + CommandPalette entry.

## 2. Incremental Control Migration

EditorPage line 524 has unified `addElement(type, overrides)` callback. All 17 `addXxxElement` are thin wrappers. Ribbon can call `addElement('shape', { shape: 'circle' })` directly.

## 3. Props Threading Reduction

**Three-layer approach:**
- Layer 1: State already in Zustand (read via selectors, zero props)
- Layer 2: Extract `useElementInsertion` hook (~250 LOC from EditorPage)
- Layer 3: Extract `useModalState` hook (~50 LOC from EditorPage)
- Layer 4: Grouped prop objects for RibbonShell

## 4. EditorPage Decomposition Order

| Tier | Hook | LOC | Risk |
|------|------|-----|------|
| 1 | use-modal-state.js | ~50 | Low |
| 1 | use-save-status.js | ~170 | Low |
| 2 | use-element-insertion.js | ~250 | Medium |
| 2 | use-element-editing.js | ~120 | Medium |
| 3 | use-editor-undo-redo.js | ~30 | Low |
| 4 | use-presentation-actions.js | ~200 | High |

## 5. Test Strategy

| Layer | Purpose | Tool |
|-------|---------|------|
| Unit tests | Per ribbon tab component | Vitest + renderToString |
| Parity tests | Old vs new, same callbacks | Vitest |
| E2E tests | Dual selectors (old + ribbon) | Playwright |

## 6. Zustand Store Design

Add to `ui-store.js` (NOT separate store):
- `activeTab: 'home'`
- `ribbonCollapsed: false`
- `useRibbon: false` (feature flag)

Format tab contextual type: DERIVED from `editor-store.selectedElementIds`, NOT stored.
