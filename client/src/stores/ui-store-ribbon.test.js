import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from './ui-store'

describe('ui-store ribbon state', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeTab: 'home',
      lastNonContextualTab: 'home',
      formatContext: { hasSelection: false, elementType: null },
      formatAutoActivatedForSelection: false,
    })
  })

  it('defaults to home tab', () => {
    expect(useUIStore.getState().activeTab).toBe('home')
  })

  it('setActiveTab updates activeTab', () => {
    useUIStore.getState().setActiveTab('insert')
    expect(useUIStore.getState().activeTab).toBe('insert')
  })

  it('setActiveTab validates non-contextual tab ids', () => {
    const validTabs = ['home', 'insert', 'design', 'transitions', 'animations', 'view']
    for (const tab of validTabs) {
      useUIStore.getState().setActiveTab(tab)
      expect(useUIStore.getState().activeTab).toBe(tab)
      expect(useUIStore.getState().lastNonContextualTab).toBe(tab)
    }
  })

  it('[cap:control.ribbon.contextual-format] auto-activates Format and restores the last valid static tab', () => {
    useUIStore.getState().setActiveTab('design')
    useUIStore.getState().setFormatContext({ hasSelection: true, elementType: 'shape' })
    expect(useUIStore.getState().activeTab).toBe('format')

    useUIStore.getState().setFormatContext({ hasSelection: false, elementType: null })
    expect(useUIStore.getState().activeTab).toBe('design')
    expect(useUIStore.getState().lastNonContextualTab).toBe('design')
  })

  it('rejects programmatic Format activation without a selection', () => {
    useUIStore.getState().setActiveTab('view')
    useUIStore.getState().setActiveTab('format')
    expect(useUIStore.getState().activeTab).toBe('view')
  })
})
