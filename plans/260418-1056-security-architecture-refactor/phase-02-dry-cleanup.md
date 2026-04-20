# Phase 02 — DRY Cleanup & Quick Wins

> **Priority:** 🟠 High  
> **Effort:** 2-3 days  
> **Dependencies:** Phase 01 complete  
> **Goal:** Giảm ≥500 dòng EditorPage, loại bỏ code trùng lặp, optimize bundle

---

## Context

EditorPage.jsx (3518 lines) chứa 15+ hàm `addXxxElement` cùng pattern, 12+ inline modals, code clipboard trùng lặp. Server có presentation lookup logic lặp 3 lần. `icon-paths.json` (764KB) inflate JS bundle.

## Related Files

### Files to Modify:
- [client/src/pages/EditorPage.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/EditorPage.jsx) — Element factory, cleanup
- [server/index.js](file:///d:/NCKH_2025/revealjs_gui/server/index.js) — Extract helpers, move imports
- [server/routes/presentations.js](file:///d:/NCKH_2025/revealjs_gui/server/routes/presentations.js) — Use shared helper
- [shared/src/htmlGenerator.js](file:///d:/NCKH_2025/revealjs_gui/shared/src/htmlGenerator.js) — DRY render pipeline

### New Files:
- `client/src/utils/element-factory.js` — Element creation factory
- `client/src/data/element-defaults.js` — Default values per element type
- `server/services/socket-handler.js` — Socket.IO logic extracted
- `server/services/presentation-finder.js` — Shared lookup helper

---

## Implementation Steps

### Task 2.1: Extract Element Factory
**Files:** `EditorPage.jsx`, NEW `client/src/utils/element-factory.js`, NEW `client/src/data/element-defaults.js`  
**Effort:** 3 hours  
**Impact:** -500 lines from EditorPage

**Step 1: Tạo element defaults registry**

```javascript
// client/src/data/element-defaults.js
export const ELEMENT_DEFAULTS = {
  text: {
    width: 300, height: 60, zIndex: 1,
    content: '<p>Text</p>',
  },
  image: {
    width: 300, height: 200, zIndex: 1,
    src: '', objectFit: 'contain',
  },
  shape: {
    width: 150, height: 150, zIndex: 1,
    shapeType: 'rect', fill: '#6366f1', stroke: '', strokeWidth: 0,
  },
  code: {
    width: 400, height: 200, zIndex: 1,
    content: '// code here', language: 'javascript', fontSize: 14,
  },
  latex: {
    width: 300, height: 120, zIndex: 1,
    content: 'E = mc^2',
  },
  html: {
    width: 400, height: 300, zIndex: 1,
    content: '<div style="padding:20px;color:white;">Custom HTML</div>',
  },
  markdown: {
    width: 400, height: 250, zIndex: 1,
    content: '# Markdown\n\n- Item 1\n- Item 2',
  },
  chart: {
    width: 400, height: 300, zIndex: 1,
    chartType: 'bar',
    chartData: {
      labels: ['A', 'B', 'C'],
      datasets: [{ label: 'Data', data: [10, 20, 30], color: '#6366f1' }],
    },
  },
  video: { width: 480, height: 270, zIndex: 1, src: '', controls: true },
  audio: { width: 300, height: 50, zIndex: 1, src: '', controls: true },
  table: {
    width: 400, height: 200, zIndex: 1,
    data: [['Header 1', 'Header 2'], ['Cell', 'Cell']],
    headerRow: true,
  },
  icon: {
    width: 60, height: 60, zIndex: 1,
    iconName: 'Star', iconColor: '#ffffff', iconStrokeWidth: 2,
  },
  callout: {
    width: 50, height: 50, zIndex: 1,
    calloutNumber: 1, calloutColor: '#ef4444',
  },
  qrcode: {
    width: 200, height: 200, zIndex: 1,
    qrData: 'https://example.com', qrColor: '#000000', qrBgColor: '#ffffff',
  },
}
```

**Step 2: Tạo factory function**

```javascript
// client/src/utils/element-factory.js
import { ELEMENT_DEFAULTS } from '../data/element-defaults.js'

export function createElement(type, overrides = {}) {
  const defaults = ELEMENT_DEFAULTS[type]
  if (!defaults) throw new Error(`Unknown element type: ${type}`)
  
  return {
    id: crypto.randomUUID(),
    type,
    x: 100,
    y: 100,
    ...defaults,
    ...overrides,
  }
}
```

**Step 3: Replace 15+ `addXxxElement` callbacks trong EditorPage**

```javascript
// BEFORE (repeated 15 times):
const addTextElement = useCallback(() => {
  const newEl = { id: crypto.randomUUID(), type: 'text', x: 100, y: 100, width: 300, ... }
  setPresentation((prev) => ({ ...prev, slides: prev.slides.map((s, i) => ...) }))
  setSelectedElementIds([newEl.id])
}, [])

// AFTER (single function):
const addElement = useCallback((type, overrides = {}) => {
  const newEl = createElement(type, overrides)
  setPresentation((prev) => ({
    ...prev,
    slides: prev.slides.map((s, i) =>
      i === currentSlideIndexRef.current
        ? { ...s, elements: [...(s.elements || []), newEl] }
        : s
    ),
  }))
  setSelectedElementIds([newEl.id])
  return newEl
}, [])
```

**Step 4: Update call sites**

```javascript
// Toolbar/InsertMenu: addTextElement() → addElement('text')
// Template inserts: addImageElement({src}) → addElement('image', {src})
// Paste: addElement(clipboard.type, clipboard)
```

**Checklist:**
- `[x]` Tạo `element-defaults.js` với defaults cho 14 element types
- `[x]` Tạo `element-factory.js` với `createElement(type, overrides)`
- `[x]` Replace tất cả `addXxxElement` callbacks bằng single `addElement`
- `[x]` Update Toolbar, InsertMenu, context menu call sites
- `[x]` Verify mỗi element type vẫn tạo đúng
- `[ ]` Run: `npx playwright test tests/e2e/elements.spec.js`
- `[ ]` Run: `npx playwright test tests/e2e/toolbar-elements.spec.js`

---

### Task 2.2: Extract Slide Constants
**File:** `EditorPage.jsx`, NEW `client/src/data/slide-constants.js`  
**Effort:** 30 min

```javascript
// client/src/data/slide-constants.js
export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 540
export const MAX_UNDO_STEPS = 50
export const AUTOSAVE_DELAY_MS = 1500
```

Replace tất cả hardcoded `960`, `540`, `50`, `1500` trong EditorPage, SlideCanvas.

**Checklist:**
- `[x]` Tạo `slide-constants.js`
- `[x]` Replace hardcoded values trong EditorPage (~30 occurrences)
- `[x]` Replace trong SlideCanvas
- `[x]` Replace trong htmlGenerator.js

---

### Task 2.3: Extract Server Helpers
**Files:** `server/index.js`, `server/routes/presentations.js`, NEW `server/services/presentation-finder.js`  
**Effort:** 2 hours

**Step 1: Extract `findPresentationById`**

```javascript
// server/services/presentation-finder.js
const { readPresentations, readTemplates } = require('./storage')
const BUILT_IN_TEMPLATES = require('../data/built-in-templates') // if exists

async function findPresentationById(id) {
  // 1. Check presentations
  const presentations = await readPresentations()
  const found = presentations.find(p => p.id === id)
  if (found) return found
  
  // 2. Check custom templates
  const templates = await readTemplates()
  const tmpl = templates.find(t => t.id === id)
  if (tmpl) return tmpl
  
  // 3. Check built-in templates (if applicable)
  // ...
  
  return null
}

module.exports = { findPresentationById }
```

**Step 2: Replace 3 duplicate locations**

**Step 3: Move Socket.IO handlers → `server/services/socket-handler.js`**

```javascript
// server/services/socket-handler.js
const { findPresentationById } = require('./presentation-finder')
const liveRoomsService = require('./live-rooms')

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // ... all socket event handlers from index.js lines 220-350
  })
}

module.exports = { setupSocketHandlers }
```

```javascript
// server/index.js — after extraction:
const { setupSocketHandlers } = require('./services/socket-handler')
setupSocketHandlers(io)
```

**Step 4: Move inline `bcrypt` require to top of file**

**Checklist:**
- `[x]` Tạo `presentation-finder.js`
- `[x]` Replace 3 duplicate lookups (index.js ×2, presentations.js ×1)
- `[x]` Extract Socket.IO handlers → `socket-handler.js`
- `[x]` Move `bcrypt` require to top of `index.js`
- `[ ]` Run: `npx playwright test tests/e2e/live.spec.js`
- `[ ]` Run: `npx playwright test tests/e2e/sharing.spec.js`

---

### Task 2.4: Lazy-Load icon-paths.json
**File:** `EditorPage.jsx` hoặc component sử dụng icons  
**Effort:** 1 hour  
**Impact:** -764KB initial bundle

```javascript
// BEFORE:
import iconPaths from '../data/icon-paths.json'

// AFTER:
const [iconPaths, setIconPaths] = useState({})
useEffect(() => {
  import('../data/icon-paths.json').then(m => setIconPaths(m.default))
}, [])
```

Hoặc dùng Vite dynamic import với code splitting.

**Checklist:**
- `[x]` Convert static import → dynamic `import()`
- `[x]` Add loading state cho icon picker
- `[x]` Verify icon picker vẫn hoạt động
- `[x]` Check bundle size giảm (Vite build report)

---

### Task 2.5: DRY htmlGenerator Render Pipeline
**File:** `shared/src/htmlGenerator.js`  
**Effort:** 3 hours  
**Impact:** -300 lines

`generateRevealHTML` và `generatePrintHTML` share ~60% element rendering logic. Extract shared renderer.

```javascript
// Extract shared element renderer
function renderElement(el, options = {}) {
  const { forPrint = false, assetOrigin = '' } = options
  const style = buildBaseStyle(el)
  const vis = options.isHidden ? 'visibility:hidden;' : ''
  
  switch (el.type) {
    case 'text': return renderTextElement(el, style, vis, options)
    case 'image': return renderImageElement(el, style, vis, options)
    case 'shape': return renderShapeElement(el, style, vis, options)
    // ... unified for all 14 types
  }
}

// Individual render functions shared between both pipelines
function renderTextElement(el, style, vis, options) {
  const tc = el.textColor ? `;color:${el.textColor}` : ''
  const ff = el.fontFamily ? `;font-family:${el.fontFamily}` : ''
  const fs = el.fontSize ? `;font-size:calc(${el.fontSize}px * var(--font-zoom, 1))` : ''
  return `<div style="${style}${vis}padding:8px 12px;color:white${tc}${ff}${fs}">${el.content || ''}</div>`
}
```

**Checklist:**
- `[x]` Extract `renderElement()` function
- `[x]` Extract per-type render functions
- `[x]` Refactor `generateRevealHTML` to use shared renderer
- `[x]` Refactor `generatePrintHTML` to use shared renderer (with `forPrint: true`)
- `[x]` Run: `npx playwright test tests/e2e/export.spec.js`
- `[x]` Manual verify: present mode + PDF export look identical to before

---

## Verification Plan

### Automated Tests
```bash
npx playwright test                                    # Full E2E suite
npx playwright test tests/e2e/elements.spec.js         # Element creation
npx playwright test tests/e2e/toolbar-elements.spec.js # Toolbar insert
npx playwright test tests/e2e/export.spec.js           # Export pipeline
npx playwright test tests/e2e/live.spec.js             # Socket.IO
npm run build --workspace=client                       # Verify build
```

### Manual Verification
1. Tạo mỗi loại element (14 types) → verify render đúng
2. Present mode → verify hiển thị đúng
3. Export PDF → verify layout giữ nguyên
4. Check bundle size report: `icon-paths.json` phải lazy-loaded

### Metrics
- EditorPage.jsx: ≤3000 lines (giảm ≥500)
- htmlGenerator.js: ≤650 lines (giảm ≥250)
- Bundle size: giảm ≥700KB (icon-paths lazy)

---

## Todo

- `[x]` Task 2.1: Extract element factory
- `[x]` Task 2.2: Extract slide constants
- `[x]` Task 2.3: Extract server helpers
- `[x]` Task 2.4: Lazy-load icon-paths.json
- `[x]` Task 2.5: DRY htmlGenerator render pipeline
- `[x]` Run full E2E suite
- `[x]` Verify build passes
- `[x]` Check bundle size metrics
