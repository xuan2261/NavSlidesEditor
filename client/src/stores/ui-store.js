import { create } from 'zustand';

export const useUIStore = create((set) => ({
  // Modals — individual booleans matching EditorPage
  showGithubModal: false,
  showShareModal: false,
  showHistoryModal: false,
  showSyncModal: false,
  showTemplateModal: false,
  showMasterPanel: false,

  // Theme
  theme: 'dark', // 'light' | 'dark'

  // Panels
  leftPanelOpen: true,
  rightPanelOpen: true,

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
  setShowMasterPanel: (v) => set({ showMasterPanel: v }),

  // Theme
  setTheme: (theme) => set({ theme }),

  // Panels
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setLeftPanelOpen: (isOpen) => set({ leftPanelOpen: isOpen }),
  setRightPanelOpen: (isOpen) => set({ rightPanelOpen: isOpen }),
}));
