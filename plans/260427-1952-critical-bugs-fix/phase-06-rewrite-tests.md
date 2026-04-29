---
phase: 6
title: "Rewrite tests for new store API"
status: "completed"
priority: P0
effort: "30m"
dependencies: [1]
---

# Phase 6: Rewrite Tests for New Store API

## Overview
Rewrite `presentation-store.test.js` after removing dead CRUD actions (Phase 1). The old tests test the dead API that no longer exists. Replace with tests for the new minimal API.

## Requirements
- Tests the new 4-export store API: `presentation`, `loading`, `setPresentation`, `setLoading`
- Tests are minimal since the store is now a dumb data holder
- Remove tests for dead CRUD actions
- Keep tests that verify store correctly holds presentation data

## Architecture

### Old Tests (to remove)
All tests that call:
- `setCurrentSlide()`
- `updateSlide()`
- `updateElement()`
- `addElement()`
- `deleteElement()`
- `addSlide()` (store version — removed)
- `deleteSlide()` (store version — removed)
- `reorderSlides()`

### New Tests (to write)
```js
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
    const deck = deck()
    usePresentationStore.getState().setPresentation(deck)
    expect(usePresentationStore.getState().presentation).toEqual(deck)
    expect(usePresentationStore.getState().loading).toBe(false)
  })

  it('sets loading state', () => {
    usePresentationStore.getState().setLoading(true)
    expect(usePresentationStore.getState().loading).toBe(true)
    usePresentationStore.getState().setLoading(false)
    expect(usePresentationStore.getState().loading).toBe(false)
  })

  it('does not have dead CRUD actions', () => {
    const store = usePresentationStore.getState()
    expect(typeof store.updateSlide).toBe('undefined')
    expect(typeof store.updateElement).toBe('undefined')
    expect(typeof store.addElement).toBe('undefined')
    expect(typeof store.deleteElement).toBe('undefined')
    expect(typeof store.addSlide).toBe('undefined')
    expect(typeof store.deleteSlide).toBe('undefined')
    expect(typeof store.reorderSlides).toBe('undefined')
    expect(typeof store.setCurrentSlide).toBe('undefined')
  })

  it('presentation store is a dumb data holder', () => {
    const deck = deck()
    usePresentationStore.getState().setPresentation(deck)
    const state = usePresentationStore.getState()
    // Only 4 exports: presentation, loading, setPresentation, setLoading
    expect(state.presentation).toEqual(deck)
    expect(state.loading).toBe(false)
    expect(typeof state.setPresentation).toBe('function')
    expect(typeof state.setLoading).toBe('function')
  })
})
```

## Related Code Files
- Rewrite: `client/src/stores/presentation-store.test.js`

## Implementation Steps
1. Read existing `presentation-store.test.js`
2. Rewrite with new tests per architecture above
3. Verify test count: old had 3 tests, new has 4 tests
4. Run `npx vitest run client/src/stores/presentation-store.test.js`

## Success Criteria
- [ ] All new tests pass (4 tests)
- [ ] No tests for dead CRUD actions remain
- [ ] Clear documentation that store is a dumb data holder

## Risk Assessment
- Low risk — straightforward test rewrite
- Verify the test file path exists before rewriting
