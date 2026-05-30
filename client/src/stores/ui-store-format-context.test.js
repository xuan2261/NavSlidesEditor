import { describe, expect, it, beforeEach } from 'vitest'
import { useUIStore } from './ui-store'

// Reset the slice of store state this suite touches before each test so the
// singleton store does not leak state across cases.
beforeEach(() => {
  useUIStore.setState({
    activeTab: 'home',
    formatContext: { hasSelection: false, elementType: null },
    formatAutoActivatedForSelection: false,
  })
})

describe('ui-store formatContext', () => {
  it('defaults to no selection', () => {
    const { formatContext, formatAutoActivatedForSelection } = useUIStore.getState()
    expect(formatContext).toEqual({ hasSelection: false, elementType: null })
    expect(formatAutoActivatedForSelection).toBe(false)
  })

  it('auto-activates Format tab when a new selection begins', () => {
    useUIStore.getState().setFormatContext({ hasSelection: true, elementType: 'shape' })
    const s = useUIStore.getState()
    expect(s.activeTab).toBe('format')
    expect(s.formatAutoActivatedForSelection).toBe(true)
    expect(s.formatContext).toEqual({ hasSelection: true, elementType: 'shape' })
  })

  it('does not force back to Format when user left it manually while keeping selection', () => {
    // selection begins -> auto format
    useUIStore.getState().setFormatContext({ hasSelection: true, elementType: 'shape' })
    expect(useUIStore.getState().activeTab).toBe('format')
    // user moves to another tab on purpose
    useUIStore.getState().setActiveTab('insert')
    expect(useUIStore.getState().activeTab).toBe('insert')
    // selection type changes but selection itself persists -> must NOT re-trigger format
    useUIStore.getState().setFormatContext({ hasSelection: true, elementType: 'image' })
    expect(useUIStore.getState().activeTab).toBe('insert')
    expect(useUIStore.getState().formatContext.elementType).toBe('image')
  })

  it('falls back to Home when selection is lost while Format is active', () => {
    useUIStore.getState().setFormatContext({ hasSelection: true, elementType: 'shape' })
    expect(useUIStore.getState().activeTab).toBe('format')
    useUIStore.getState().setFormatContext({ hasSelection: false, elementType: null })
    const s = useUIStore.getState()
    expect(s.activeTab).toBe('home')
    expect(s.formatContext.hasSelection).toBe(false)
    expect(s.formatAutoActivatedForSelection).toBe(false)
  })

  it('keeps the current non-format tab when selection is lost', () => {
    useUIStore.setState({ activeTab: 'insert' })
    useUIStore.getState().setFormatContext({ hasSelection: false, elementType: null })
    expect(useUIStore.getState().activeTab).toBe('insert')
  })
})
