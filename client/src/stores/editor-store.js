import { create } from 'zustand'

export const useEditorStore = create((set, get) => ({
  // ─── Selection & Editing ────────────────────────────────────────────────────
  selectedElementIds: [],
  editingElementId: null,
  geometryPointEditingElementId: null,
  setGeometryPointEditingElementId: (id) => set({ geometryPointEditingElementId: id }),

  setSelectedElementIds: (ids) => {
    const next = typeof ids === 'function' ? ids(get().selectedElementIds) : ids
    set({
      selectedElementIds: next,
      geometryPointEditingElementId:
        next.length === 1 && next[0] === get().geometryPointEditingElementId ? next[0] : null,
    })
  },
  selectElement: (id) =>
    set({
      selectedElementIds: [id],
      geometryPointEditingElementId: get().geometryPointEditingElementId === id ? id : null,
    }),
  addToSelection: (id) =>
    set((s) => ({
      geometryPointEditingElementId: null,
      selectedElementIds: s.selectedElementIds.includes(id)
        ? s.selectedElementIds
        : [...s.selectedElementIds, id],
    })),
  clearSelection: () =>
    set({ selectedElementIds: [], editingElementId: null, geometryPointEditingElementId: null }),
  setEditingElementId: (id) => set({ editingElementId: id }),
  startEditing: (id) => set({ editingElementId: id }),
  stopEditing: () => set({ editingElementId: null }),

  // ─── Clipboard ──────────────────────────────────────────────────────────────
  clipboard: null,
  setClipboard: (data) =>
    set({ clipboard: typeof data === 'function' ? data(get().clipboard) : data }),

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
}))
