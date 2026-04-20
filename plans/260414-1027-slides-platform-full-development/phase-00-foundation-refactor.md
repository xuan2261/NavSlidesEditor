# Phase 0 — Foundation Refactor

## Overview
- **Priority**: P0 — PREREQUISITE cho mọi phase khác
- **Status**: 🔄 In Progress — Server refactor + Router + Stores + Hooks + SettingsPage ✅
- **Effort**: 2 tuần
- **Mục tiêu**: Tái cấu trúc kiến trúc để hỗ trợ scale-up features

## Vấn đề hiện tại

| File | LOC | Vấn đề |
|------|-----|--------|
| `EditorPage.jsx` | 3448 | God component, 50+ state variables, mọi logic |
| `server/index.js` | 1063 | Monolithic server, 29 endpoints trong 1 file |
| `App.jsx` | 37 | useState routing thay vì React Router |
| `PropertiesPanel.jsx` | 60435 bytes | Panel khổng lồ |
| `SlideCanvas.jsx` | 67116 bytes | Canvas logic phức tạp |
| `Toolbar.jsx` | 55369 bytes | Toolbar quá lớn |

## Key Insights
- Không cần TypeScript full migration ngay — chỉ cần shared types file
- Zustand nhẹ nhất cho state management (2KB gzipped, no boilerplate)
- React Router v6 cho multi-page routing
- Server tách thành route files theo REST resource

## Architecture Target

```
client/src/
├── App.jsx                    ← React Router setup
├── main.jsx
├── index.css
├── stores/                    ← NEW: Zustand stores
│   ├── presentation-store.js  ← presentation state + actions
│   ├── editor-store.js        ← UI state (selection, editing, grid...)
│   └── ui-store.js            ← modals, panels, theme
├── hooks/                     ← NEW: Custom hooks
│   ├── use-autosave.js
│   ├── use-history.js
│   ├── use-keyboard.js
│   └── use-clipboard.js
├── pages/
│   ├── HomePage.jsx           ← SLIM: only layout + data fetching
│   ├── EditorPage.jsx         ← SLIM: layout shell, pulls from stores
│   ├── PresentPage.jsx        ← NEW: full-screen present mode
│   ├── SharePage.jsx          ← NEW: shared presentation viewer
│   └── SettingsPage.jsx       ← NEW: API keys, preferences
├── components/
│   ├── editor/                ← NEW: split from monolithic components
│   │   ├── Toolbar.jsx
│   │   ├── ToolbarInsert.jsx
│   │   ├── ToolbarFormat.jsx
│   │   └── ToolbarActions.jsx
│   ├── canvas/
│   │   ├── SlideCanvas.jsx
│   │   ├── CanvasElement.jsx
│   │   └── CanvasOverlays.jsx
│   ├── panels/
│   │   ├── SlidePanel.jsx
│   │   ├── PropertiesPanel.jsx
│   │   ├── TextProperties.jsx
│   │   ├── ImageProperties.jsx
│   │   ├── ShapeProperties.jsx
│   │   └── ...per-type panels
│   ├── modals/
│   │   ├── ExportModal.jsx
│   │   ├── ShareModal.jsx
│   │   ├── GithubModal.jsx
│   │   ├── HistoryModal.jsx
│   │   └── SyncModal.jsx
│   └── common/
│       ├── ColorPicker.jsx
│       ├── NumberInput.jsx
│       └── Modal.jsx
├── extensions/                ← existing TipTap extensions
└── utils/                     ← existing utilities

server/
├── index.js                   ← SLIM: app setup + middleware + listen
├── routes/
│   ├── presentations.js       ← CRUD + export + present
│   ├── templates.js           ← template CRUD
│   ├── share.js               ← share token management
│   ├── upload.js              ← file upload
│   ├── github.js              ← GitHub integration
│   ├── sync.js                ← rclone sync
│   ├── history.js             ← version snapshots
│   └── settings.js            ← NEW: AI config, preferences
├── services/
│   ├── storage.js             ← JSON file read/write + locking
│   ├── html-generator.js      ← reveal.js HTML generation
│   └── file-utils.js          ← path validation, cleanup
└── middleware/
    ├── validate-id.js         ← UUID validation
    └── error-handler.js       ← centralized error handling
```

## Implementation Steps

### Step 1: Install Dependencies
```bash
npm install zustand react-router-dom
```

### Step 2: Create Zustand Stores

#### `stores/presentation-store.js`
```javascript
import { create } from 'zustand'

export const usePresentationStore = create((set, get) => ({
  presentation: null,
  currentSlideIndex: 0,
  loading: true,
  
  // Actions
  setPresentation: (p) => set({ presentation: p }),
  setCurrentSlide: (idx) => set({ currentSlideIndex: idx }),
  
  updateSlide: (slideIndex, updates) => set(state => ({
    presentation: {
      ...state.presentation,
      slides: state.presentation.slides.map((s, i) =>
        i === slideIndex ? { ...s, ...updates } : s
      )
    }
  })),
  
  updateElement: (elementId, updates) => set(state => {
    const idx = state.currentSlideIndex
    return {
      presentation: {
        ...state.presentation,
        slides: state.presentation.slides.map((s, i) =>
          i === idx ? {
            ...s,
            elements: s.elements.map(el =>
              el.id === elementId ? { ...el, ...updates } : el
            )
          } : s
        )
      }
    }
  }),
  
  addElement: (element) => set(state => {
    const idx = state.currentSlideIndex
    return {
      presentation: {
        ...state.presentation,
        slides: state.presentation.slides.map((s, i) =>
          i === idx ? { ...s, elements: [...s.elements, element] } : s
        )
      }
    }
  }),
  
  deleteElement: (elementId) => set(state => {
    const idx = state.currentSlideIndex
    return {
      presentation: {
        ...state.presentation,
        slides: state.presentation.slides.map((s, i) =>
          i === idx ? {
            ...s,
            elements: s.elements.filter(el => el.id !== elementId)
          } : s
        )
      }
    }
  }),
  
  // Slide management
  addSlide: (slide, afterIndex) => set(state => {
    const slides = [...state.presentation.slides]
    slides.splice(afterIndex + 1, 0, slide)
    return {
      presentation: { ...state.presentation, slides },
      currentSlideIndex: afterIndex + 1
    }
  }),
  
  deleteSlide: (index) => set(state => {
    if (state.presentation.slides.length <= 1) return state
    const slides = state.presentation.slides.filter((_, i) => i !== index)
    return {
      presentation: { ...state.presentation, slides },
      currentSlideIndex: Math.min(state.currentSlideIndex, slides.length - 1)
    }
  }),
  
  reorderSlides: (fromIndex, toIndex) => set(state => {
    const slides = [...state.presentation.slides]
    const [moved] = slides.splice(fromIndex, 1)
    slides.splice(toIndex, 0, moved)
    return {
      presentation: { ...state.presentation, slides },
      currentSlideIndex: toIndex
    }
  }),
}))
```

#### `stores/editor-store.js`
```javascript
import { create } from 'zustand'

export const useEditorStore = create((set) => ({
  selectedElementIds: [],
  editingElementId: null,
  clipboard: null,
  showGrid: false,
  gridSize: 40,
  smartGuidesEnabled: true,
  showRulers: false,
  guides: [],
  showTimeline: false,
  showFindReplace: false,

  // Selection
  selectElement: (id) => set({ selectedElementIds: [id] }),
  addToSelection: (id) => set(s => ({
    selectedElementIds: [...s.selectedElementIds, id]
  })),
  clearSelection: () => set({ selectedElementIds: [], editingElementId: null }),
  
  // Editing
  startEditing: (id) => set({ editingElementId: id }),
  stopEditing: () => set({ editingElementId: null }),
  
  // Clipboard
  setClipboard: (data) => set({ clipboard: data }),
  
  // Grid/Guides
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),
  toggleRulers: () => set(s => ({ showRulers: !s.showRulers })),
  toggleSmartGuides: () => set(s => ({ smartGuidesEnabled: !s.smartGuidesEnabled })),
  addGuide: (guide) => set(s => ({ guides: [...s.guides, guide] })),
  removeGuide: (index) => set(s => ({
    guides: s.guides.filter((_, i) => i !== index)
  })),
}))
```

### Step 3: Setup React Router

```javascript
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor/:id" element={<EditorPage />} />
        <Route path="/template/:id" element={<EditorPage isTemplate />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### Step 4: Extract Custom Hooks

#### `hooks/use-autosave.js`
- Lấy logic autosave từ EditorPage useEffect (line 585-606)
- Debounce 1500ms, gọi API save

#### `hooks/use-history.js`
- Lấy undo/redo logic từ EditorPage (line 609-623)
- historyRef + redoStackRef
- Expose: undo(), redo(), pushHistory()

#### `hooks/use-keyboard.js`
- Lấy keyboard shortcut handler
- Ctrl+Z/Y, Ctrl+C/X/V/D, Delete, Escape, Ctrl+F

#### `hooks/use-clipboard.js`
- Copy, cut, paste, duplicate logic

### Step 5: Slim Down EditorPage

**Strategy**: Incremental extraction — mỗi step test lại toàn bộ functionality

1. Tạo stores → verify app vẫn hoạt động
2. Migrate state variables từ EditorPage → stores (từng batch 5-10 variables)
3. Extract hooks (autosave → history → keyboard → clipboard)
4. Xóa prop drilling — components đọc trực tiếp từ stores
5. Tách modals thành components riêng trong `components/modals/`
6. Tách PropertiesPanel thành per-type panels

### Step 6: Restructure Server

1. Tạo `server/routes/*.js` — move mỗi nhóm endpoints
2. Tạo `server/services/storage.js` — abstract JSON read/write
3. Tạo `server/middleware/` — validate-id, error-handler
4. Slim `server/index.js` → chỉ app setup + mount routes

### Step 7: Add Settings Infrastructure

- `SettingsPage.jsx` — quản lý:
  - AI API key (lưu vào `server/data/settings.json`)
  - Default theme, transition
  - Grid preferences
  - Export preferences
- API endpoints: `GET/PUT /api/settings`

## Files Modified

| File | Action |
|------|--------|
| `client/src/App.jsx` | MODIFY — React Router |
| `client/src/pages/EditorPage.jsx` | MAJOR MODIFY — slim down |
| `client/src/pages/HomePage.jsx` | MODIFY — use router navigation |
| `client/src/stores/presentation-store.js` | NEW |
| `client/src/stores/editor-store.js` | NEW |
| `client/src/stores/ui-store.js` | NEW |
| `client/src/hooks/use-autosave.js` | NEW |
| `client/src/hooks/use-history.js` | NEW |
| `client/src/hooks/use-keyboard.js` | NEW |
| `client/src/hooks/use-clipboard.js` | NEW |
| `client/src/pages/SettingsPage.jsx` | NEW |
| `client/src/components/modals/*.jsx` | NEW — extracted from EditorPage |
| `server/routes/*.js` | NEW — extracted from server/index.js |
| `server/services/storage.js` | NEW |
| `server/middleware/*.js` | NEW |
| `server/index.js` | MAJOR MODIFY — slim |
| `package.json` | MODIFY — add zustand, react-router-dom |

## Todo List

- [ ] Install zustand + react-router-dom
- [ ] Create presentation-store.js
- [ ] Create editor-store.js
- [ ] Create ui-store.js
- [ ] Setup React Router in App.jsx
- [ ] Extract use-autosave hook
- [ ] Extract use-history hook
- [ ] Extract use-keyboard hook
- [ ] Extract use-clipboard hook
- [ ] Migrate EditorPage state → stores (batch 1: presentation state)
- [ ] Migrate EditorPage state → stores (batch 2: editor UI state)
- [ ] Migrate EditorPage state → stores (batch 3: modal state)
- [ ] Extract modal components from EditorPage
- [ ] Split PropertiesPanel into per-type panels
- [ ] Split Toolbar into sub-components
- [ ] Create server/routes/ structure
- [ ] Create server/services/storage.js
- [ ] Create server/middleware/
- [ ] Slim server/index.js
- [ ] Create SettingsPage + API
- [ ] Verify all existing features still work
- [ ] Run E2E tests

## Success Criteria

- [ ] No single client file exceeds 400 LOC
- [ ] No single server file exceeds 300 LOC
- [ ] EditorPage only manages layout, delegates to stores/hooks
- [ ] All existing features work (create, edit, present, export, share, sync)
- [ ] React Router supports /editor/:id, /template/:id, /settings
- [ ] No prop drilling deeper than 1 level
