# Scout Report: Current Editor Architecture Inventory

**Date:** 2026-05-17
**Scope:** EditorPage, Toolbar, InsertMenu, EditorMenuBar, PropertiesPanel, stores, hooks

## File Inventory

| File | LOC | Role |
|------|-----|------|
| `client/src/pages/EditorPage.jsx` | 1952 | God component, all editor state |
| `client/src/components/Toolbar.jsx` | 1294 | 2-row toolbar + InsertMenu |
| `client/src/components/InsertMenu.jsx` | 621 | 22+ element types in dropdown |
| `client/src/components/EditorMenuBar.jsx` | 420 | File/View/Settings/AI/Share menus |
| `client/src/components/PropertiesPanel.jsx` | 472 | Element/slide properties sidebar |
| `client/src/stores/ui-store.js` | 40 | Modals, theme, panels |
| `client/src/stores/editor-store.js` | 76 | Selection, clipboard, canvas, zoom |

## Hooks (Reusable)

| Hook | LOC | Ribbon Reuse |
|------|-----|-------------|
| `use-slide-operations.js` | 344 | HIGH — align, group/ungroup |
| `use-keyboard.js` | 215 | HIGH — shortcut dispatch |
| `use-clipboard.js` | 200 | HIGH — copy/cut/paste |

## Property Editors (Reusable)

| File | LOC | Reuse |
|------|-----|-------|
| `common-element-controls.jsx` | 244 | Format tab: position/size/rotation |
| `shape-properties.jsx` | 187 | Shape Format group |
| `image-properties.jsx` | 142 | Image Format group |
| `chart-properties.jsx` | 116 | Chart Format group |
| `table-properties.jsx` | 193 | Table Format group |
| `media-properties.jsx` | 140 | Media Format group |
| `code-properties.jsx` | 100 | Code Format group |

## UI Primitives

- `Button`, `Input`, `Select`, `ColorPicker`, `ModalShell` from `components/ui/`
- `cn()` utility from `lib/utils.js`

## Key Finding

No `client/src/components/ribbon/` directory exists. All ribbon code is greenfield.

## Key Callbacks in EditorPage

- `addElement(type, overrides)` — unified element factory (line 524)
- 17 thin wrappers: `addTextElement`, `addShapeElement`, etc.
- `updateElement`, `deleteElement`, `updateCurrentSlide`
- `handleCopy/Cut/Paste/Duplicate`, `handleUndo/Redo`
- `startEditingElement`, `stopEditingElement`
- `bringElementForward`, `sendElementBackward`
