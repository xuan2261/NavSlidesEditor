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

export const useUIStore = create((set) => ({
  // Modals — individual booleans matching EditorPage
  showGithubModal: false,
  showShareModal: false,
  showHistoryModal: false,
  showSyncModal: false,
  showTemplateModal: false,

  // Theme
  theme: 'dark', // 'light' | 'dark'

  // Panels
  leftPanelOpen: true,
  rightPanelOpen: true,

  // Ribbon
  activeTab: (() => {
    try {
      localStorage.removeItem('navslides-ribbon-use-ribbon')
      const storedTab = localStorage.getItem('navslides-ribbon-active-tab')
      return VALID_RIBBON_TABS.has(storedTab) ? storedTab : 'home'
    } catch { return 'home' }
  })(),

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

  // Theme
  setTheme: (theme) => set({ theme }),

  // Panels
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setLeftPanelOpen: (isOpen) => set({ leftPanelOpen: isOpen }),
  setRightPanelOpen: (isOpen) => set({ rightPanelOpen: isOpen }),

  // Ribbon
  setActiveTab: (tab) => {
    if (!VALID_RIBBON_TABS.has(tab)) tab = 'home'
    try { localStorage.setItem('navslides-ribbon-active-tab', tab) } catch { /* ignore */ }
    set({ activeTab: tab })
  },
}))
