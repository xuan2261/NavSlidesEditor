import { create } from 'zustand'

const VALID_RIBBON_TABS = new Set([
  'home',
  'insert',
  'design',
  'format',
  'transitions',
  'animations',
  'view',
])

const clampZoom = (v) => Math.max(0.1, Math.min(4, v))

export const useUIStore = create((set, get) => ({
  // Modals — individual booleans matching EditorPage
  showGithubModal: false,
  showShareModal: false,
  showHistoryModal: false,
  showSyncModal: false,
  showTemplateModal: false,

  // Editor modal/visibility flags migrated out of EditorPage local useState.
  // Names match the original EditorPage flags verbatim so call sites change
  // only their source (useState -> useUIStore), not the read/write shape.
  showTemplateGallery: false,
  showMediaLibrary: false,
  showTransitionPreview: false,
  showAnimationPreview: false,
  showCssEditor: false,
  showAICopywriter: false,
  showAIGenerator: false,
  showAITranslate: false,
  showLiveModal: false,
  showAnalytics: false,
  showImageUrlPrompt: false,
  showCommandPalette: false,
  showKineticTextModal: false,
  showMathGridModal: false,
  showAnimeModal: false,
  showThreeModal: false,
  showFileBrowser: false,

  // Theme
  theme: 'dark', // 'light' | 'dark'

  // Panels
  leftPanelOpen: true,
  rightPanelOpen: true,
  showDesignIdeas: false,

  // Zoom — shared between SlideCanvas and StatusBar
  zoom: 1,
  userZoomMode: false,

  // Slide position + present action — bridge EditorPage (local state / window
  // opener) to the global StatusBar that lives outside the editor tree.
  // total>0 also doubles as the "editor is active" signal that gates the
  // right-hand status cluster (only EditorPage calls setSlidePosition).
  slidePosition: { current: 0, total: 0 },
  presentHandler: null,

  // Ribbon
  activeTab: (() => {
    try {
      localStorage.removeItem('navslides-ribbon-use-ribbon')
      const storedTab = localStorage.getItem('navslides-ribbon-active-tab')
      return VALID_RIBBON_TABS.has(storedTab) ? storedTab : 'home'
    } catch { return 'home' }
  })(),

  // Format-tab context — bridges EditorPage selection to the ribbon TabBar
  // without prop-drilling selectedElement through RibbonHeaderBar.
  // formatAutoActivatedForSelection enforces "auto-activate Format on the first
  // render of a new selection, but respect a manual tab change afterwards".
  formatContext: { hasSelection: false, elementType: null },
  formatAutoActivatedForSelection: false,

  // Actions — Modals
  openModal: (name) => set({ [`show${name}Modal`]: true }),
  closeModal: (name) => set({ [`show${name}Modal`]: false }),
  toggleModal: (name) => set((s) => ({ [`show${name}Modal`]: !s[`show${name}Modal`] })),

  // Convenience setters
  setShowGithubModal: (v) => set({ showGithubModal: v }),
  setShowShareModal: (v) => set({ showShareModal: v }),
  setShowHistoryModal: (v) => set({ showHistoryModal: v }),
  setShowSyncModal: (v) => set({ showSyncModal: v }),
  setShowTemplateModal: (v) => set({ showTemplateModal: v }),

  // Convenience setters for migrated editor flags. Accept a direct boolean OR
  // an updater fn (some call sites use setShowX((v) => !v)), matching the
  // useState API they replace.
  setShowTemplateGallery: (v) => set((s) => ({ showTemplateGallery: typeof v === 'function' ? v(s.showTemplateGallery) : v })),
  setShowMediaLibrary: (v) => set((s) => ({ showMediaLibrary: typeof v === 'function' ? v(s.showMediaLibrary) : v })),
  setShowTransitionPreview: (v) => set((s) => ({ showTransitionPreview: typeof v === 'function' ? v(s.showTransitionPreview) : v })),
  setShowAnimationPreview: (v) => set((s) => ({ showAnimationPreview: typeof v === 'function' ? v(s.showAnimationPreview) : v })),
  setShowCssEditor: (v) => set((s) => ({ showCssEditor: typeof v === 'function' ? v(s.showCssEditor) : v })),
  setShowAICopywriter: (v) => set((s) => ({ showAICopywriter: typeof v === 'function' ? v(s.showAICopywriter) : v })),
  setShowAIGenerator: (v) => set((s) => ({ showAIGenerator: typeof v === 'function' ? v(s.showAIGenerator) : v })),
  setShowAITranslate: (v) => set((s) => ({ showAITranslate: typeof v === 'function' ? v(s.showAITranslate) : v })),
  setShowLiveModal: (v) => set((s) => ({ showLiveModal: typeof v === 'function' ? v(s.showLiveModal) : v })),
  setShowAnalytics: (v) => set((s) => ({ showAnalytics: typeof v === 'function' ? v(s.showAnalytics) : v })),
  setShowImageUrlPrompt: (v) => set((s) => ({ showImageUrlPrompt: typeof v === 'function' ? v(s.showImageUrlPrompt) : v })),
  setShowCommandPalette: (v) => set((s) => ({ showCommandPalette: typeof v === 'function' ? v(s.showCommandPalette) : v })),
  setShowKineticTextModal: (v) => set((s) => ({ showKineticTextModal: typeof v === 'function' ? v(s.showKineticTextModal) : v })),
  setShowMathGridModal: (v) => set((s) => ({ showMathGridModal: typeof v === 'function' ? v(s.showMathGridModal) : v })),
  setShowAnimeModal: (v) => set((s) => ({ showAnimeModal: typeof v === 'function' ? v(s.showAnimeModal) : v })),
  setShowThreeModal: (v) => set((s) => ({ showThreeModal: typeof v === 'function' ? v(s.showThreeModal) : v })),
  setShowFileBrowser: (v) => set((s) => ({ showFileBrowser: typeof v === 'function' ? v(s.showFileBrowser) : v })),

  // Theme
  setTheme: (theme) => set({ theme }),

  // Panels
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setLeftPanelOpen: (isOpen) => set({ leftPanelOpen: isOpen }),
  setRightPanelOpen: (isOpen) => set({ rightPanelOpen: isOpen }),
  toggleDesignIdeas: () => set((s) => ({ showDesignIdeas: !s.showDesignIdeas })),
  setShowDesignIdeas: (v) => set((s) => ({ showDesignIdeas: typeof v === 'function' ? v(s.showDesignIdeas) : v })),

  // Ribbon
  setActiveTab: (tab) => {
    if (!VALID_RIBBON_TABS.has(tab)) tab = 'home'
    try { localStorage.setItem('navslides-ribbon-active-tab', tab) } catch { /* ignore */ }
    set({ activeTab: tab })
  },

  // Sync EditorPage selection into the ribbon. Auto-activates Format the first
  // time a selection appears (none -> some); once the user navigates away while
  // the selection persists, later type changes must not yank them back.
  setFormatContext: ({ hasSelection, elementType }) => {
    const prev = get()
    if (hasSelection && !prev.formatContext.hasSelection) {
      get().setActiveTab('format')
      set({ formatAutoActivatedForSelection: true })
    }
    if (!hasSelection) {
      set({ formatAutoActivatedForSelection: false })
      if (get().activeTab === 'format') get().setActiveTab('home')
    }
    set({ formatContext: { hasSelection, elementType } })
  },

  // Zoom actions
  setZoom: (v) => set((s) => ({ zoom: clampZoom(typeof v === 'function' ? v(s.zoom) : v) })),
  setUserZoomMode: (v) => set({ userZoomMode: !!v }),
  zoomIn: () => set((s) => ({ zoom: clampZoom(s.zoom + 0.1), userZoomMode: true })),
  zoomOut: () => set((s) => ({ zoom: clampZoom(s.zoom - 0.1), userZoomMode: true })),
  fitZoom: () => set({ userZoomMode: false }),

  // Slide position + present action setters.
  setSlidePosition: ({ current, total }) => set({ slidePosition: { current, total } }),
  // Plain set on purpose: a function-updater idiom would call fn(state) here and
  // open the present window the moment EditorPage registers the handler.
  setPresentHandler: (fn) => set({ presentHandler: fn }),
}))
