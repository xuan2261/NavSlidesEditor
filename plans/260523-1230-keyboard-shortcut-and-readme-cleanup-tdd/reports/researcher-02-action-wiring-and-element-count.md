# Researcher-02: Action Wiring & Element Count
**Date:** 2026-05-23 | **Plan:** 260523-1230-keyboard-shortcut-and-readme-cleanup-tdd

---

## Part 1 — 8 Missing Shortcut Handlers

### Architecture note
`useKeyboard` dispatches by converting shortcut `id` → `on{Id}` callback. Registry has all 8 IDs. EditorPage passes NO callbacks for them. Fix = add to (a) `useKeyboard` destructure/deps/callbacks, (b) `useKeyboard({...})` call in EditorPage.

`zoom` and `setZoom` are NOT destructured from `useEditorStore` in EditorPage (confirmed: only canvas-controls.jsx imports them). Must add:
```js
const zoom = useEditorStore((s) => s.zoom)
const setZoom = useEditorStore((s) => s.setZoom)
```

---

### 1. `insertSlide` (Ctrl+M)

**Verdict:** STUB — `commands[0].action` calls `setShowTemplateModal(true)` (line 1102) but `useKeyboard({})` has no `onInsertSlide`.  
Command palette wires it correctly via `setShowTemplateModal`; keyboard does not.  
`addSlide` (from `useSlideOperations`) also exists at line 912 for blank-slide insert — either is valid. `setShowTemplateModal(true)` matches UX intent (opens template picker, consistent with slide panel "+" button).

**Wiring in EditorPage `useKeyboard({...})`:**
```js
onInsertSlide: () => setShowTemplateModal(true),
```

**use-keyboard.js additions:**
- Destructure param: `onInsertSlide,`
- Pass to `createKeyboardHandler`: `onInsertSlide,`
- Deps array: `onInsertSlide,`

---

### 2. `group` (Ctrl+G)

**Verdict:** EXISTS — `groupElements` at `use-slide-operations.js:93`, destructured in EditorPage at line 909. Not in `useKeyboard({...})`.

**Wiring:**
```js
onGroup: () => groupElements(),
```

**use-keyboard.js additions:** `onGroup` in all 3 locations.

---

### 3. `ungroup` (Ctrl+Shift+G)

**Verdict:** EXISTS — `ungroupElements` at `use-slide-operations.js:113`, destructured line 910. Not in `useKeyboard({...})`.

**Wiring:**
```js
onUngroup: () => ungroupElements(),
```

**use-keyboard.js additions:** `onUngroup` in all 3 locations.

---

### 4. `bringForward` (Ctrl+])

**Verdict:** EXISTS — `bringElementForward(id)` defined inline in EditorPage at line 928. Already passed to `ArrangeControls` at lines 1506 & 1620 as `onBringForward`. Not in `useKeyboard({...})`.

**Wiring:**
```js
onBringForward: () => { if (selectedElementIds.length === 1) bringElementForward(selectedElementIds[0]) },
```

**use-keyboard.js additions:** `onBringForward` in all 3 locations.

---

### 5. `sendBackward` (Ctrl+[)

**Verdict:** EXISTS — `sendElementBackward(id)` at line 937. Paired with bringForward in ribbon wiring.

**Wiring:**
```js
onSendBackward: () => { if (selectedElementIds.length === 1) sendElementBackward(selectedElementIds[0]) },
```

**use-keyboard.js additions:** `onSendBackward` in all 3 locations.

---

### 6. `resetZoom` (Ctrl+0)

**Verdict:** STUB — commands[2].action is `console.log('[zoom] reset')` (line 1108). Implementation confirmed in `canvas-controls.jsx:92`: `setZoom(1)`.

**Wiring:**
```js
onResetZoom: () => setZoom(1),
```

**use-keyboard.js additions:** `onResetZoom` in all 3 locations.  
**EditorPage store additions:** `const zoom = useEditorStore((s) => s.zoom)` + `const setZoom = useEditorStore((s) => s.setZoom)`

---

### 7. `zoomIn` (Ctrl+=)

**Verdict:** STUB — line 1106 is `console.log`. Implementation: `canvas-controls.jsx:74`: `setZoom(Math.min((zoom || 1) + 0.1, 3))`.

**Wiring:**
```js
onZoomIn: () => setZoom(Math.min((zoom || 1) + 0.1, 3)),
```

**use-keyboard.js additions:** `onZoomIn` in all 3 locations.

---

### 8. `zoomOut` (Ctrl+-)

**Verdict:** STUB — line 1107 is `console.log`. Implementation: `canvas-controls.jsx:83`: `setZoom(Math.max((zoom || 1) - 0.1, 0.2))`.

**Wiring:**
```js
onZoomOut: () => setZoom(Math.max((zoom || 1) - 0.1, 0.2)),
```

**use-keyboard.js additions:** `onZoomOut` in all 3 locations.

---

### Summary table

| Shortcut | Status | Implementation source |
|---|---|---|
| insertSlide Ctrl+M | STUB | `setShowTemplateModal(true)` — EditorPage line 198/1102 |
| group Ctrl+G | EXISTS | `use-slide-operations.js:93` |
| ungroup Ctrl+Shift+G | EXISTS | `use-slide-operations.js:113` |
| bringForward Ctrl+] | EXISTS | EditorPage inline line 928 |
| sendBackward Ctrl+[ | EXISTS | EditorPage inline line 937 |
| resetZoom Ctrl+0 | STUB | `setZoom(1)` — canvas-controls.jsx:92 |
| zoomIn Ctrl+= | STUB | `setZoom(Math.min(z + 0.1, 3))` — canvas-controls.jsx:74 |
| zoomOut Ctrl+- | STUB | `setZoom(Math.max(z - 0.1, 0.2))` — canvas-controls.jsx:83 |

---

## Part 2 — Element Type Count Truth

### Definitive element type count: 19

From `element-defaults.js` ELEMENT_DEFAULTS keys (canonical `element.type` values):

```
text, image, shape, code, latex, html, markdown, chart,
video, audio, table, icon, callout, qrcode, drawing, line, svg, timeline, game
```

= **19 types**

README line 36 says "20 element types" and lists **"divider"** — but `divider` is NOT a separate element type. `addDividerElement` (EditorPage:624) inserts a `line` element with preset coordinates. There is no `divider` key in `element-defaults.js`, no `DividerRenderer` in registry, no `divider` in `DEFAULT_POSITIONS`.

README also lists **"inline math"** separately from LaTeX — also not a distinct type. `math` is rendered via TipTap inline extension (text element content), not a canvas element type.

Registry count (13): misses `text`, `image`, `code`, `html`, `video`, `audio` — these use native HTML/TipTap renderers in SlideCanvas directly, not the `elementRendererRegistry`. Registry is not the canonical count source.

### Definitive insert action count: 26

From `ribbon-insert-tab-element-galleries-panel.jsx`:

| Section | Actions |
|---|---|
| Basic | text, image (URL), image (upload) = 3 |
| Shapes | shapes-gallery (trigger), line, arrow, callout, icon = 5 |
| Content | chart, table, code, markdown, latex, qrcode = 6 |
| Media | video, audio/upload, media-library, file-browser (conditional) = 3–4 |
| Embed | html, svg, drawing, divider = 4 |
| Advanced | kinetic-text, math-grid, anime.js, three.js, timeline, games-gallery = 6 |

**Total: 27 insert actions** (28 if file-browser shown); game gallery expands to 7 game sub-types but is one trigger = 1 action.

### Truth source recommendation

**Cite `element-defaults.js`** as canonical. Reasons:
- Single source of truth: `createElement()` in `element-factory.js` reads it directly
- Registry misses 6 types (native renderers); insert panel counts UI actions, not types
- README should say **"19 element types"** (remove "divider" and "inline math" from the count; keep them in prose as features of existing types)

### How to keep this accurate (for CONTRIBUTING / CLAUDE.md)

```
Element type count: canonical list = Object.keys(ELEMENT_DEFAULTS) in
client/src/data/element-defaults.js. When adding a new type, update that
file first. README "N element types" count must equal
Object.keys(ELEMENT_DEFAULTS).length. "divider" is a line preset,
not a type — do not add it. Registry.js and insert-panel counts diverge
by design and should not be used as the count source.
```

---

## Unresolved Questions

1. `zoomIn`/`zoomOut` clamp values: canvas-controls uses max=3, min=0.2 — confirm these are the intended keyboard limits (vs. different limits on pinch-zoom or scroll-zoom paths).
2. `insertSlide` intent: open template modal (Ctrl+M = template picker, consistent with "+" button) vs. `addSlide('blank')` for a faster insert. Plan phase should decide.
3. `bringForward`/`sendBackward` with multi-selection: current callbacks guard `selectedElementIds.length === 1`. Should they operate on all selected elements? Current ribbon buttons (`selectedElementId`, singular) also operate on one element — consistent for now, but worth noting.
