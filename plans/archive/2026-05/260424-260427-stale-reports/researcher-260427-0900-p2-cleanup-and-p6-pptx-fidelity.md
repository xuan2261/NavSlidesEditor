# Research Report: Phase 2 Cleanup & Phase 6 PPTX Import Fidelity

**Date:** 2026-04-27
**Author:** researcher subagent

---

## Phase 2: Clipboard/Keyboard Cleanup

### Current State

Three files own clipboard/keyboard logic:

| File | Role | State |
|------|------|-------|
| `use-keyboard.js` | Factory hook (`useKeyboard`) + `createKeyboardHandler` | ✅ Exists, not called by SlideCanvas |
| `use-clipboard.js` | `performCopy/Paste/Cut/Duplicate` via Zustand | ✅ Exists, not called by SlideCanvas |
| `SlideCanvas.jsx` | Inline keyboard handler (L508-659) + context menu clipboard ops (L1281-1385) | ❌ Duplicates everything above |

### Duplicate Code Map

```
SlideCanvas.jsx keyboard handler (L508-659)
  ├── Ctrl+C copy       → duplicates use-clipboard.performCopy (L17-26)
  ├── Ctrl+X cut        → duplicates use-clipboard.performCut (L43-47)
  ├── Ctrl+V paste      → duplicates use-clipboard.performPaste (L28-41)
  ├── Ctrl+D duplicate  → duplicates use-clipboard.performDuplicate (L49-78)
  └── Context menu copy/cut/paste/duplicate (L1281-1385) → same ops inline
```

**Key duplication patterns:**

- `performCopy` (use-clipboard L22-25): filters slide elements by selected IDs, strips `id`, calls `setClipboard`
- SlideCanvas inline copy (L562-569): same filter/split/clone logic, calls `setClipboard`
- `performDuplicate` (use-clipboard L49-78): copies to clipboard, waits 50ms, then adds elements with 20px offset
- SlideCanvas inline duplicate (L604-623): directly calls `onAddElements`, no clipboard write, 0ms
- Context menu paste (L1328-1330): reads `clipboardRef.current`, same offset pattern

### Why `use-keyboard.js` Is Dead Code

`createKeyboardHandler` accepts `onCopy/onCut/onPaste/onDuplicate` callbacks — exactly what SlideCanvas should pass. But SlideCanvas never calls `useKeyboard`. Instead it has a raw `document.addEventListener('keydown', onKeyDown)` at L648.

### What Needs to Be Removed

1. **Inline keyboard handler** in SlideCanvas L508-659 (document listener + all clipboard/cut/paste/duplicate/arrow/delete/Escape logic)
2. **Context menu clipboard ops** in SlideCanvas L1281-1385 (`setClipboard(clones)` x2, `clipboardRef` paste, `onAddElements`)
3. **`clipboardRef`** (L274): `const clipboardRef = useRef(null)` + sync effect (L276) + all reads (L592, 636)
4. **`setClipboard`** store subscription (L273): no longer needed inline

### What Needs to Replace Them

```
EditorPage.jsx wires:
  useKeyboard({
    onCopy: performCopy,
    onCut: performCut,
    onPaste: performPaste,
    onDuplicate: performDuplicate,
    onDelete: handleDeleteSelected,
    onSelectAll: handleSelectAll,
    onToggleFindReplace: toggleFindReplace,
    onEscape: clearSelection,
    isEditing: !!editingElementId,
  })
```

Context menu clipboard ops in SlideCanvas should call the same `onCopy/onCut/onPaste/onDuplicate` props passed from EditorPage.

### Critical Risk: `performDuplicate` vs Inline Duplicate Semantic Difference

| Behavior | use-clipboard | SlideCanvas inline |
|----------|--------------|-------------------|
| Writes to clipboard | Yes (L59) | No |
| Delay before add | 50ms setTimeout | 0ms (sync) |
| Adds offset | +20px both axes | +20px both axes |

If the 50ms delay in `performDuplicate` is intentional (to avoid clipboard race), EditorPage needs to pass the same semantics. If it's accidental, `performDuplicate` should be sync.

### Test Coverage Needed

| Test | File | What to cover |
|------|------|---------------|
| Unit | `use-keyboard.test.js` (new) | Each shortcut: copy/cut/paste/duplicate/delete/Escape/selectAll/ctrl-Z/ctrl-Y/ctrl-F; skip when `isEditing=true`; skip in INPUT/TEXTAREA |
| Unit | `use-clipboard.test.js` | `performCopy`: no-op when empty selection; `performPaste`: assigns new UUIDs, +20px offset; `performCut`: deletes originals; `performDuplicate`: same |
| Integration | `SlideCanvas.test.jsx` (extend) | Context menu Copy/Cut/Paste/Duplicate buttons trigger correct store actions |
| E2E | `clipboard-shortcuts.spec.js` | Ctrl+C/X/V/D keyboard shortcut end-to-end in editor |

---

## Phase 6: PPTX Import Fidelity — Specific Gaps

### Chart Metadata Gaps

**`_pptxChartMeta` currently captures (chart-output-to-navslides-mapper.js L42-48):**
```js
{
  originalType, barDir, holeSize, marker, grouping
}
```

**Missing:**
1. **Legend position** — `element.legend` or `element.legendPos` not read; Chart.js default (top) used unconditionally
2. **Axis titles** — `element.xAxis?.title`, `element.yAxis?.title` not mapped; `_pptxChartMeta` has no axis field
3. **Tick labels / number formats** — `element.xAxis?.numFmt`, `element.yAxis?.tickLblSkip` ignored
4. **Chart title** — `element.title` or `element.chartTitle` not read from element root
5. **Dual axis (combo charts)** — no detection or mapping for secondary Y axis
6. **3D settings** — `element.view3D`, `element.depth`, `element.angle` not read (relevant for bar/column)

**Detection fragility in `mapScatterChart` (L57):**
```js
if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[0]) && Array.isArray(data[1]))
```
This `length >= 2` check catches valid 2-point scatter datasets but also 2-series charts. Should also check `element.chartType` string before this branch.

### SmartArt/Diagram Coverage

**`flattenDiagramElement` (mapper.js L606-647) issues:**

1. **Node positioning is broken** (L634-635):
   ```js
   const nodeX = readCoord(element.left, element.x, 0) + readCoord(node.left, null, (i * boxWidth) / maxNodes)
   ```
   Uses linear array index `i` for horizontal position — this destroys any real SmartArt layout. Should read `node.left` or `node.x` from the actual diagram node data. Fallback should be grid/radial layout computed from node count, not linear index scaling.

2. **No connector/arrow preservation** — SmartArt connectors (`element.connectors`, `element.arrows`) are ignored; after flattening to shapes, relationships between nodes are lost.

3. **Node shape type not preserved** — `node.shape` or `node.shapType` used in `shapeName()` but if nodes have no explicit shape, all become rect.

4. **No layout type detection** — `element.layout` or `element.diagramType` not read; can't distinguish list/hierarchy/cycle/target layouts to inform fallback rendering.

### OLE Fallback Strategy

**Current state:** No OLE detection or handling. `mapElement` falls through to `placeholder` (L495) silently.

**What PPTX files contain OLE objects:**
- Embedded Excel charts
- Embedded Word documents
- Embedded PowerPoint (slides within slides)
- Embedded PDFs
- Custom linked objects

**Recommended OLE fallback tier:**

| OLE Type | Fallback | Priority |
|----------|----------|---------|
| Linked Excel/PDF | Download link stored as `link` element | P0 |
| Embedded Excel chart | Placeholder with `_pptxImportMeta.oleType: 'excel-chart'` | P1 |
| Embedded Word | Rasterized thumbnail + `_pptxImportMeta.oleType: 'word-doc'` | P1 |
| Embedded PDF | Extract first page as image (reuse `pdf-import.js` raster path) | P1 |
| Unknown | Placeholder with `oleType: 'unknown'` and warning | P2 |

**Implementation approach:** In `mapElement`, add:
```js
if (element.type === 'ole' || element.oleType || element.isOle) {
  // extract oleClass, oleData from element
  return [placeholder(..., 'ole-object', `Embedded ${element.oleClass || 'OLE object'} (unsupported)`)]
  // P1: add logic to persist thumbnail or link
}
```

The `sanitize.js` or `importer.js` layer needs to pass through `oleType`/`oleClass` from pptxtojson output if present.

### Corpus Sufficiency

**Current corpus:** 4 decks in `server/data/test-corpus/`.

**What's missing from corpus for Phase 6 targets:**
- SmartArt/deep-group-heavy deck (for `MAX_GROUP_DEPTH` boundary + diagram flattening)
- Multi-series chart deck with legend + axis titles
- OLE-embedded deck (Excel-linked chart)
- 100+ slide deck (for performance benchmark)
- Scatter chart with ≥3 data points (to test the `data.length >= 2` detection edge case)

**Recommended minimum corpus for Phase 6:** 10 decks, adding the 5 above.

### PDF Import Architecture Note

`pdf-import.js` uses canvas rasterization at scale=2 (L32), uploads as PNG, then wraps in a `image` element. This is intentional: no text extraction, no layout preservation. It's appropriate for a "PDF as images" import path. No changes needed unless user asks for selectable text PDF import (separate feature).

---

## Unresolved Questions

1. **Phase 2**: Is the 50ms `setTimeout` in `performDuplicate` intentional or a race-condition workaround? Affects whether EditorPage integration needs to preserve this delay.
2. **Phase 6**: Does pptxtojson output `oleType`/`oleClass` fields for embedded objects, or are they dropped entirely at parse time? Needs corpus testing with an OLE-embedded deck.
3. **Phase 6**: Does pptxtojson expose `element.legend` or `element.legendPos` in chart output? Needs `npm run test:corpus -- --verbose` trace to confirm.

---

**Status:** DONE
