import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorActiveSlideController } from './use-editor-active-slide-controller'

const deck = {
  slides: [
    { id: 'parent', elements: [{ id: 'parent-el' }], children: [{ id: 'child', elements: [{ id: 'child-el' }] }] },
  ],
}

describe('useEditorActiveSlideController', () => {
  it('routes writes to an active vertical child and preserves the parent', () => {
    let current = deck
    const setPresentation = (updater) => {
      current = updater(current)
    }
    const { result } = renderHook(() =>
      useEditorActiveSlideController({
        presentation: current,
        setPresentation,
        currentSlideIndex: 0,
        verticalEdit: { parentId: 'parent', child: 0 },
        setVerticalEdit: () => {},
      })
    )

    act(() => setPresentation((previous) => result.current.mapActive(previous, (slide) => ({ ...slide, marker: true }))))

    expect(current.slides[0].marker).toBeUndefined()
    expect(current.slides[0].children[0].marker).toBe(true)
  })

  it('reconciles a stale child selection', () => {
    let verticalEdit = { parentId: 'parent', child: 4 }
    renderHook(() =>
      useEditorActiveSlideController({
        presentation: deck,
        setPresentation: () => {},
        currentSlideIndex: 0,
        verticalEdit,
        setVerticalEdit: (next) => {
          verticalEdit = next
        },
      })
    )
    expect(verticalEdit).toBeNull()
  })
})
