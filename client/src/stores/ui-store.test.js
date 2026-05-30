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

  it('defaults all migrated editor modal flags to closed', () => {
    const s = useUIStore.getState()
    const flags = [
      'showTemplateGallery',
      'showMediaLibrary',
      'showTransitionPreview',
      'showAnimationPreview',
      'showCssEditor',
      'showAICopywriter',
      'showAIGenerator',
      'showAITranslate',
      'showLiveModal',
      'showAnalytics',
      'showImageUrlPrompt',
      'showCommandPalette',
      'showKineticTextModal',
      'showMathGridModal',
      'showAnimeModal',
      'showThreeModal',
      'showFileBrowser',
    ]
    for (const f of flags) {
      expect(s[f]).toBe(false)
    }
  })

  it('exposes a convenience setter for each migrated flag that flips the right key', () => {
    const cases = [
      ['setShowAICopywriter', 'showAICopywriter'],
      ['setShowAIGenerator', 'showAIGenerator'],
      ['setShowAITranslate', 'showAITranslate'],
      ['setShowCommandPalette', 'showCommandPalette'],
      ['setShowMediaLibrary', 'showMediaLibrary'],
      ['setShowCssEditor', 'showCssEditor'],
      ['setShowLiveModal', 'showLiveModal'],
      ['setShowAnalytics', 'showAnalytics'],
      ['setShowImageUrlPrompt', 'showImageUrlPrompt'],
      ['setShowTemplateGallery', 'showTemplateGallery'],
      ['setShowTransitionPreview', 'showTransitionPreview'],
      ['setShowAnimationPreview', 'showAnimationPreview'],
      ['setShowKineticTextModal', 'showKineticTextModal'],
      ['setShowMathGridModal', 'showMathGridModal'],
      ['setShowAnimeModal', 'showAnimeModal'],
      ['setShowThreeModal', 'showThreeModal'],
      ['setShowFileBrowser', 'showFileBrowser'],
    ]
    for (const [setter, flag] of cases) {
      useUIStore.getState()[setter](true)
      expect(useUIStore.getState()[flag]).toBe(true)
      useUIStore.getState()[setter](false)
      expect(useUIStore.getState()[flag]).toBe(false)
    }
  })

  it('supports functional updates for toggle-style call sites', () => {
    useUIStore.setState({ showCommandPalette: false })
    useUIStore.getState().setShowCommandPalette((v) => !v)
    expect(useUIStore.getState().showCommandPalette).toBe(true)
    useUIStore.getState().setShowCommandPalette((v) => !v)
    expect(useUIStore.getState().showCommandPalette).toBe(false)
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

  describe('zoom', () => {
    beforeEach(() => {
      useUIStore.setState({ zoom: 1, userZoomMode: false })
    })

    it('has zoom 1 and userZoomMode false initially', () => {
      const { zoom, userZoomMode } = useUIStore.getState()
      expect(zoom).toBe(1)
      expect(userZoomMode).toBe(false)
    })

    it('setZoom updates zoom, clamped to [0.1, 4]', () => {
      useUIStore.getState().setZoom(0.5)
      expect(useUIStore.getState().zoom).toBe(0.5)
      useUIStore.getState().setZoom(10)
      expect(useUIStore.getState().zoom).toBe(4)
      useUIStore.getState().setZoom(0.01)
      expect(useUIStore.getState().zoom).toBe(0.1)
    })

    it('zoomIn increases zoom by 0.1 and sets userZoomMode true', () => {
      useUIStore.getState().zoomIn()
      expect(useUIStore.getState().zoom).toBeCloseTo(1.1)
      expect(useUIStore.getState().userZoomMode).toBe(true)
    })

    it('zoomOut decreases zoom by 0.1 and sets userZoomMode true', () => {
      useUIStore.getState().zoomOut()
      expect(useUIStore.getState().zoom).toBeCloseTo(0.9)
      expect(useUIStore.getState().userZoomMode).toBe(true)
    })

    it('zoomIn clamps at 4', () => {
      useUIStore.setState({ zoom: 4 })
      useUIStore.getState().zoomIn()
      expect(useUIStore.getState().zoom).toBe(4)
    })

    it('zoomOut clamps at 0.1', () => {
      useUIStore.setState({ zoom: 0.1 })
      useUIStore.getState().zoomOut()
      expect(useUIStore.getState().zoom).toBe(0.1)
    })

    it('fitZoom sets userZoomMode false (allows auto-fit)', () => {
      useUIStore.setState({ userZoomMode: true })
      useUIStore.getState().fitZoom()
      expect(useUIStore.getState().userZoomMode).toBe(false)
    })

    it('setUserZoomMode toggles the flag', () => {
      useUIStore.getState().setUserZoomMode(true)
      expect(useUIStore.getState().userZoomMode).toBe(true)
      useUIStore.getState().setUserZoomMode(false)
      expect(useUIStore.getState().userZoomMode).toBe(false)
    })
  })
})
