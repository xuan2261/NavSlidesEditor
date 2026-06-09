import { create } from 'zustand'

export const useEditorStore = create((set, get) => ({
  // ─── Selection & Editing ────────────────────────────────────────────────────
  selectedElementIds: [],
  editingElementId: null,

  setSelectedElementIds: (ids) =>
    set({ selectedElementIds: typeof ids === 'function' ? ids(get().selectedElementIds) : ids }),
  selectElement: (id) => set({ selectedElementIds: [id] }),
  addToSelection: (id) =>
    set((s) => ({
      selectedElementIds: [...s.selectedElementIds, id],
    })),
  clearSelection: () => set({ selectedElementIds: [], editingElementId: null }),
  setEditingElementId: (id) => set({ editingElementId: id }),
  startEditing: (id) => set({ editingElementId: id }),
  stopEditing: () => set({ editingElementId: null }),

  // ─── Clipboard ──────────────────────────────────────────────────────────────
  clipboard: null,
  setClipboard: (data) =>
    set({ clipboard: typeof data === 'function' ? data(get().clipboard) : data }),
  copySelected: (elements, selectedIds) => {
    const clones = elements
      .filter((el) => selectedIds.includes(el.id))
      .map((el) => ({ ...el, id: undefined }))
    set({ clipboard: clones })
  },
  cutSelected: (elements, selectedIds) => {
    const clones = elements
      .filter((el) => selectedIds.includes(el.id))
      .map((el) => ({ ...el, id: undefined }))
    set({ clipboard: clones })
  },

  // Cascade counter so repeated pastes of one clipboard fan out instead of
  // overlapping. Bumped after each paste, zeroed when a fresh copy/cut starts.
  pasteCount: 0,
  incrementPasteCount: () => set((s) => ({ pasteCount: s.pasteCount + 1 })),
  resetPasteCount: () => set({ pasteCount: 0 }),

  // ─── Canvas Controls ───────────────────────────────────────────────────────
  showGrid: false,
  gridSize: 40,
  smartGuidesEnabled: true,
  showRulers: false,
  guides: [],

  setShowGrid: (v) => set({ showGrid: typeof v === 'function' ? v(get().showGrid) : v }),
  setGridSize: (v) => set({ gridSize: typeof v === 'function' ? v(get().gridSize) : v }),
  setSmartGuidesEnabled: (v) =>
    set({ smartGuidesEnabled: typeof v === 'function' ? v(get().smartGuidesEnabled) : v }),
  setShowRulers: (v) => set({ showRulers: typeof v === 'function' ? v(get().showRulers) : v }),
  setGuides: (v) => set({ guides: typeof v === 'function' ? v(get().guides) : v }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  toggleSmartGuides: () => set((s) => ({ smartGuidesEnabled: !s.smartGuidesEnabled })),
  addGuide: (guide) => set((s) => ({ guides: [...s.guides, guide] })),
  removeGuide: (index) =>
    set((s) => ({
      guides: s.guides.filter((_, i) => i !== index),
    })),

  // ─── Panel / View State ────────────────────────────────────────────────────
  showTimeline: false,
  showFindReplace: false,
  viewMode: 'normal', // 'normal' | 'sorter'

  setShowTimeline: (v) =>
    set({ showTimeline: typeof v === 'function' ? v(get().showTimeline) : v }),
  setShowFindReplace: (v) =>
    set({ showFindReplace: typeof v === 'function' ? v(get().showFindReplace) : v }),
  setViewMode: (v) => set({ viewMode: typeof v === 'function' ? v(get().viewMode) : v }),

  // ─── Zoom (0.25 to 4.0) ───────────────────────────────────────────────────
  zoom: 1,
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
  zoomIn: () => set((s) => ({ zoom: Math.min(4, s.zoom + 0.25) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(0.25, s.zoom - 0.25) })),
  resetZoom: () => set({ zoom: 1 }),
}))
