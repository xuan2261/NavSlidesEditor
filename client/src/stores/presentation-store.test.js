import { beforeEach, describe, expect, it } from 'vitest'
import { usePresentationStore } from './presentation-store'

function deck() {
  return {
    id: 'deck-1',
    title: 'Deck',
    slides: [
      { id: 'slide-1', background: { type: 'color', color: '#111111' }, elements: [] },
      { id: 'slide-2', elements: [] },
    ],
  }
}

describe('presentation-store', () => {
  beforeEach(() => {
    usePresentationStore.setState({ presentation: null, loading: true })
  })

  it('sets and clears presentation data', () => {
    const d = deck()
    usePresentationStore.getState().setPresentation(d)
    expect(usePresentationStore.getState().presentation).toEqual(d)
    expect(usePresentationStore.getState().loading).toBe(false)
  })

  it('sets loading state', () => {
    usePresentationStore.getState().setLoading(true)
    expect(usePresentationStore.getState().loading).toBe(true)
    usePresentationStore.getState().setLoading(false)
    expect(usePresentationStore.getState().loading).toBe(false)
  })

  it('adopts successor generation without replacing local edits', () => {
    usePresentationStore.getState().setPresentation({ ...deck(), title: 'Local', aggregateGeneration: 2 })
    usePresentationStore.getState().adoptAggregateGeneration(3)
    expect(usePresentationStore.getState().presentation).toMatchObject({
      title: 'Local',
      aggregateGeneration: 3,
    })
  })

  it('retains local and remote choices for generation conflicts', () => {
    const local = { ...deck(), title: 'Unsaved local' }
    usePresentationStore.getState().setSaveConflict(local, 7)
    expect(usePresentationStore.getState().saveConflict).toEqual({
      local,
      remoteGeneration: 7,
      choices: ['keep-local', 'use-remote'],
    })
  })

  it('does not have dead CRUD actions', () => {
    const store = usePresentationStore.getState()
    expect(typeof store.setCurrentSlide).toBe('undefined')
    expect(typeof store.updateSlide).toBe('undefined')
    expect(typeof store.updateElement).toBe('undefined')
    expect(typeof store.addElement).toBe('undefined')
    expect(typeof store.deleteElement).toBe('undefined')
    expect(typeof store.addSlide).toBe('undefined')
    expect(typeof store.deleteSlide).toBe('undefined')
    expect(typeof store.reorderSlides).toBe('undefined')
    expect(typeof store.currentSlideIndex).toBe('undefined')
  })

  it('presentation store is a dumb data holder', () => {
    const d = deck()
    usePresentationStore.getState().setPresentation(d)
    const state = usePresentationStore.getState()
    // Only 4 exports: presentation, loading, setPresentation, setLoading
    expect(state.presentation).toEqual(d)
    expect(state.loading).toBe(false)
    expect(typeof state.setPresentation).toBe('function')
    expect(typeof state.setLoading).toBe('function')
  })
})
