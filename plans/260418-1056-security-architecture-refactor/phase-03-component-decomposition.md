# Phase 03 — Component Decomposition

> **Priority:** 🟠 High  
> **Effort:** 5-7 days  
> **Dependencies:** Phase 02 complete  
> **Goal:** EditorPage ≤1500 lines. Zustand stores active. Modals tách file riêng.

---

## Context

Sau Phase 02, EditorPage vẫn ~3000 lines với 60+ useState, 12+ inline modals, và tất cả state chưa migrate vào Zustand stores. Phase này tập trung vào 3 việc chính:
1. Extract inline modals → separate components
2. Migrate state → Zustand stores
3. Split PropertiesPanel by element type

## Strategy: Bottom-Up Migration

**Quan trọng:** Migrate **từng phần nhỏ**, verify sau mỗi step. KHÔNG refactor toàn bộ cùng lúc.

Thứ tự migration:
1. Modals (low risk — independent, ít state dependency)
2. UI state → Zustand (medium risk — selection, editing, clipboard)
3. Presentation state → Zustand (high risk — core data, undo/redo)
4. Split PropertiesPanel (medium risk — render-only refactor)

---

## Implementation Steps

### Task 3.1: Extract Inline Modals
**File:** `EditorPage.jsx` → nhiều file mới  
**Effort:** 1 day  
**Impact:** -800 lines from EditorPage

EditorPage chứa ~12 modals render inline. Tách từng modal thành component riêng.

**Modal inventory (từ code review):**

| Modal | Approx Lines | New File |
|-------|-------------|----------|
| Sync/Proton Drive | ~150 | Đã có pattern tương tự |
| Version History | ~120 | `HistoryModal.jsx` |
| Live Presentation | ~100 | `LivePresentationModal.jsx` |
| GitHub Push | ~80 | `GitHubPushModal.jsx` |
| CSS Editor | ~100 | `CSSEditorModal.jsx` |
| Template Gallery | ~150 | Đã tách: `TemplateGallery.jsx` (verify) |
| Image URL Input | ~30 | Inline OK (quá nhỏ) |
| Keyboard Shortcuts | ~80 | `KeyboardShortcutsModal.jsx` |
| Settings | ~100 | `SettingsModal.jsx` |
| Sync Config | ~200 | `SyncModal.jsx` |

**Pattern cho mỗi modal:**

```jsx
// client/src/components/HistoryModal.jsx
import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { X, Clock } from 'lucide-react'

export default function HistoryModal({ presentationId, onRestore, onClose }) {
  const [snapshots, setSnapshots] = useState([])
  const [snapshotName, setSnapshotName] = useState('')
  
  useEffect(() => {
    api.getSnapshots(presentationId).then(setSnapshots)
  }, [presentationId])
  
  // ... render logic moved from EditorPage
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        {/* ... */}
      </div>
    </div>
  )
}
```

**EditorPage sau extraction:**
```jsx
// BEFORE: 150 lines of inline modal JSX
{showHistoryModal && (
  <div style={{position: 'fixed', ...}}>
    {/* 120 lines of modal content */}
  </div>
)}

// AFTER: 3 lines
{showHistoryModal && (
  <HistoryModal presentationId={presentationId} onRestore={handleRestore} onClose={() => setShowHistoryModal(false)} />
)}
```

**Execution order (lowest risk first):**
1. `HistoryModal` (self-contained, own API calls)
2. `SyncModal` (self-contained)
3. `GitHubPushModal` (self-contained)
4. `LivePresentationModal` (depends on Socket.IO state)
5. `CSSEditorModal` (depends on presentation state)
6. `KeyboardShortcutsModal` (static content)
7. `SettingsModal` (depends on settings state)

**Checklist:**
- `[x]` Extract HistoryModal ✅ (self-contained CRUD)
- `[x]` Extract SyncModal ✅ (rclone state internalized)
- `[x]` Extract GitHubPushModal ✅ (config + push internalized)
- `[x]` Extract LivePresentationModal ✅ (room code + links)
- `[x]` Extract CSSEditorModal ✅ (controlled via onUpdate callback)
- `[ ]` Extract KeyboardShortcutsModal
- `[ ]` Extract SettingsModal
- `[x]` Verify mỗi modal mở/đóng đúng (build passes)
- `[ ]` Run full E2E suite
- `[x]` Đo: EditorPage giảm ≥800 lines (3079 → 2273 = -806 lines)

---

### Task 3.2: Migrate UI State → Zustand `editor-store`
**Files:** `EditorPage.jsx`, `client/src/stores/editor-store.js`  
**Effort:** 1 day

**Existing store (đã tạo sẵn nhưng chưa dùng):**
```javascript
// stores/editor-store.js (current - 52 lines)
import { create } from 'zustand'
export const useEditorStore = create((set) => ({
  selectedElementIds: [],
  setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),
  // ...
}))
```

**State to migrate (UI-only, low risk):**

| State | From EditorPage | To Store | Notes |
|-------|----------------|----------|-------|
| `selectedElementIds` | `useState([])` | `editor-store` | Đã có trong store |
| `editingElementId` | `useState(null)` | `editor-store` | Đã có trong store |
| `clipboard` | `useState(null)` | `editor-store` | Đã có trong store |
| `showGrid` | `useState(false)` | `editor-store` | Đã có trong store |
| `snapToGrid` | `useState(true)` | `editor-store` | |
| `gridSize` | `useState(20)` | `editor-store` | |
| `showRulers` | `useState(true)` | `editor-store` | |
| `showGuides` | `useState(true)` | `editor-store` | |
| `zoom` | `useState(1)` | `editor-store` | |
| `canvasTool` | `useState('select')` | `editor-store` | |

**Migration pattern (per state variable):**

```javascript
// BEFORE (EditorPage.jsx):
const [selectedElementIds, setSelectedElementIds] = useState([])

// AFTER (EditorPage.jsx):
const selectedElementIds = useEditorStore(s => s.selectedElementIds)
const setSelectedElementIds = useEditorStore(s => s.setSelectedElementIds)
```

**Important:** Migrate **một state variable tại một thời điểm**, test sau mỗi lần migrate. Đây là cách an toàn nhất.

**Checklist:**
- `[ ]` Update `editor-store.js` với tất cả UI state fields
- `[ ]` Migrate `selectedElementIds` → test
- `[ ]` Migrate `editingElementId` → test
- `[ ]` Migrate `clipboard` → test
- `[ ]` Migrate grid/ruler/guide states → test
- `[ ]` Migrate `zoom` → test
- `[ ]` Migrate `canvasTool` → test
- `[ ]` Update SlideCanvas, PropertiesPanel để đọc từ store thay vì props
- `[ ]` Remove migrated `useState` declarations từ EditorPage
- `[ ]` Run full E2E suite

---

### Task 3.3: Migrate Presentation State → Zustand `presentation-store`
**Files:** `EditorPage.jsx`, `client/src/stores/presentation-store.js`  
**Effort:** 2 days (HIGH RISK — core data)

**⚠️ Đây là task rủi ro cao nhất. Thực hiện cẩn thận.**

**State to migrate:**

| State | Risk | Notes |
|-------|------|-------|
| `presentation` | 🔴 High | Core data object |
| `currentSlideIndex` | 🟠 Medium | Active slide |
| `loading` | 🟢 Low | UI state |

**Presentation store expansion:**

```javascript
// stores/presentation-store.js
import { create } from 'zustand'
import { api } from '../utils/api'

export const usePresentationStore = create((set, get) => ({
  presentation: null,
  currentSlideIndex: 0,
  loading: true,
  
  // Actions
  setPresentation: (data) => set({ presentation: typeof data === 'function' ? data(get().presentation) : data }),
  setCurrentSlideIndex: (idx) => set({ currentSlideIndex: typeof idx === 'function' ? idx(get().currentSlideIndex) : idx }),
  
  // Derived
  currentSlide: () => {
    const { presentation, currentSlideIndex } = get()
    return presentation?.slides?.[currentSlideIndex] || null
  },
  
  // Element CRUD (consolidate from EditorPage)
  addElement: (element) => set(state => ({
    presentation: {
      ...state.presentation,
      slides: state.presentation.slides.map((s, i) =>
        i === state.currentSlideIndex
          ? { ...s, elements: [...(s.elements || []), element] }
          : s
      ),
    },
  })),
  
  updateElement: (id, updates) => set(state => ({
    presentation: {
      ...state.presentation,
      slides: state.presentation.slides.map((s, i) =>
        i === state.currentSlideIndex
          ? { ...s, elements: s.elements.map(el => el.id === id ? { ...el, ...updates } : el) }
          : s
      ),
    },
  })),
  
  deleteElements: (ids) => set(state => ({
    presentation: {
      ...state.presentation,
      slides: state.presentation.slides.map((s, i) =>
        i === state.currentSlideIndex
          ? { ...s, elements: s.elements.filter(el => !ids.includes(el.id)) }
          : s
      ),
    },
  })),
  
  // Slide CRUD
  addSlide: (slide) => set(state => ({
    presentation: { ...state.presentation, slides: [...state.presentation.slides, slide] },
    currentSlideIndex: state.presentation.slides.length,
  })),
  
  deleteSlide: (index) => set(state => {
    if (state.presentation.slides.length <= 1) return state
    return {
      presentation: {
        ...state.presentation,
        slides: state.presentation.slides.filter((_, i) => i !== index),
      },
      currentSlideIndex: Math.min(state.currentSlideIndex, state.presentation.slides.length - 2),
    }
  }),
  
  // Load
  loadPresentation: async (id) => {
    set({ loading: true })
    try {
      const data = await api.getPresentation(id)
      set({ presentation: data, loading: false, currentSlideIndex: 0 })
    } catch {
      set({ loading: false })
    }
  },
}))
```

**Migration approach:**
1. Expand store với tất cả actions
2. Import store trong EditorPage, nhưng **keep old useState** song song (dual-write)
3. Verify cả hai sources cho cùng giá trị
4. Chuyển child components sang đọc từ store
5. Remove old useState

**Checklist:**
- `[ ]` Expand presentation-store với full CRUD actions
- `[ ]` Add `addElement`, `updateElement`, `deleteElements`
- `[ ]` Add `addSlide`, `deleteSlide`, `duplicateSlide`, `moveSlide`
- `[ ]` Add `loadPresentation` async action
- `[ ]` Migrate EditorPage sang store (dual-write phase)
- `[ ]` Migrate child components (SlideCanvas, PropertiesPanel)
- `[ ]` Remove old useState from EditorPage
- `[ ]` Verify undo/redo vẫn hoạt động (integrate with history)
- `[ ]` Run full E2E suite
- `[ ]` Run: `npx playwright test tests/e2e/undo-redo.spec.js`

---

### Task 3.4: Split PropertiesPanel by Element Type
**File:** `PropertiesPanel.jsx` (1755 lines) → sub-panels  
**Effort:** 1 day

**Tách theo element type:**

| Sub-panel | Elements | New File |
|-----------|----------|----------|
| TextProperties | text | `properties/TextProperties.jsx` |
| ImageProperties | image | `properties/ImageProperties.jsx` |
| ShapeProperties | shape | `properties/ShapeProperties.jsx` |
| CodeProperties | code | `properties/CodeProperties.jsx` |
| ChartProperties | chart | `properties/ChartProperties.jsx` |
| MediaProperties | video, audio | `properties/MediaProperties.jsx` |
| TableProperties | table | `properties/TableProperties.jsx` |
| EmbedProperties | html, markdown, latex | `properties/EmbedProperties.jsx` |
| MiscProperties | icon, callout, qrcode | `properties/MiscProperties.jsx` |

**PropertiesPanel becomes a router:**

```jsx
// PropertiesPanel.jsx (~100 lines after refactor)
import TextProperties from './properties/TextProperties'
import ImageProperties from './properties/ImageProperties'
// ...

const PANEL_MAP = {
  text: TextProperties,
  image: ImageProperties,
  shape: ShapeProperties,
  // ...
}

export default function PropertiesPanel({ element, onUpdate }) {
  if (!element) return <EmptyState />
  const Panel = PANEL_MAP[element.type]
  if (!Panel) return <div>Unknown type: {element.type}</div>
  return <Panel element={element} onUpdate={onUpdate} />
}
```

**Checklist:**
- `[ ]` Tạo `client/src/components/properties/` directory
- `[ ]` Extract TextProperties (largest)
- `[ ]` Extract ImageProperties
- `[ ]` Extract ShapeProperties
- `[ ]` Extract remaining sub-panels
- `[ ]` Refactor PropertiesPanel thành type router
- `[ ]` Run: `npx playwright test tests/e2e/properties-panel.spec.js`
- `[ ]` Đo: PropertiesPanel.jsx ≤150 lines

---

### Task 3.5: Resolve Duplicate Clipboard Logic
**Files:** `EditorPage.jsx`, `SlideCanvas.jsx`  
**Effort:** 2 hours

Two competing clipboard implementations. Consolidate into one.

**Decision:** Keep SlideCanvas multi-element clipboard (newer, more capable). Remove EditorPage single-element clipboard.

**Checklist:**
- `[ ]` Remove clipboard keydown listener từ EditorPage
- `[ ]` Verify SlideCanvas clipboard handles all cases (single + multi)
- `[ ]` Move clipboard state vào editor-store (nếu chưa)
- `[ ]` Run: `npx playwright test tests/e2e/keyboard-shortcuts.spec.js`

---

## Verification Plan

### Automated Tests
```bash
npx playwright test                              # Full suite
npx playwright test tests/e2e/editor.spec.js     # Core editor
npx playwright test tests/e2e/undo-redo.spec.js  # Undo/redo
npx playwright test tests/e2e/keyboard-shortcuts.spec.js
npm run build --workspace=client                  # Build verify
```

### Manual Verification
1. Mở editor, tạo từng loại element → verify render
2. Select element → verify PropertiesPanel hiển thị đúng sub-panel
3. Multi-select → group → verify hoạt động
4. Undo/redo → verify 50 steps vẫn hoạt động
5. Clipboard: copy/paste single + multi → verify
6. Mở từng modal → verify open/close/function

### Metrics
- EditorPage.jsx: ≤1500 lines (target)
- PropertiesPanel.jsx: ≤150 lines (router only)
- Zustand stores: actively used (0 direct useState for migrated state)
- All E2E tests pass

---

## Todo

- `[ ]` Task 3.1: Extract inline modals (-800 lines)
- `[ ]` Task 3.2: Migrate UI state → Zustand editor-store
- `[ ]` Task 3.3: Migrate presentation state → Zustand presentation-store
- `[ ]` Task 3.4: Split PropertiesPanel by element type
- `[ ]` Task 3.5: Resolve duplicate clipboard logic
- `[ ]` Run full E2E suite
- `[ ]` Verify build passes
- `[ ]` Measure final line counts
