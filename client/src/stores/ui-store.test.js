import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from './ui-store'

describe('ui-store', () => {
  beforeEach(() => {
    useUIStore.setState({
      showGithubModal: false,
      showShareModal: false,
      showHistoryModal: false,
      showSyncModal: false,
      showTemplateModal: false,
      theme: 'dark',
      leftPanelOpen: true,
      rightPanelOpen: true,
    })
  })

  it('opens, closes, and toggles named modals', () => {
    useUIStore.getState().openModal('Github')
    expect(useUIStore.getState().showGithubModal).toBe(true)

    useUIStore.getState().toggleModal('Github')
    expect(useUIStore.getState().showGithubModal).toBe(false)

    useUIStore.getState().setShowSyncModal(true)
    useUIStore.getState().closeModal('Sync')
    expect(useUIStore.getState().showSyncModal).toBe(false)
  })

  it('tracks theme and panel visibility', () => {
    useUIStore.getState().setTheme('light')
    useUIStore.getState().toggleLeftPanel()
    useUIStore.getState().setRightPanelOpen(false)

    expect(useUIStore.getState()).toMatchObject({
      theme: 'light',
      leftPanelOpen: false,
      rightPanelOpen: false,
    })
  })
})
