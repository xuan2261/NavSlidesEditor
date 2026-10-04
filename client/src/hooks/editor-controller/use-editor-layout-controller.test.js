import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorLayoutController } from './use-editor-layout-controller'
import { createInteractionSlideState, executeInteractionAction } from 'revealjs-shared'

const initialPresentation = {
  slides: [{ id: 'slide-1', elements: [] }],
  layoutMasters: [
    {
      id: 'layout-1',
      name: 'Custom master',
      fixedElements: [
        { id: 'band', type: 'shape', x: 0, y: 0, width: 300, height: 40, locked: true },
      ],
      placeholders: [],
    },
  ],
}

function useHarness(initial = initialPresentation) {
  const [presentation, setPresentation] = useState(initial)
  const controller = useEditorLayoutController({
    presentation,
    setPresentation,
    mapActive: (previous, transform) => ({
      ...previous,
      slides: previous.slides.map((slide, index) => (index === 0 ? transform(slide) : slide)),
    }),
    setSelectedElementIds: vi.fn(),
  })
  return { presentation, ...controller }
}

describe('useEditorLayoutController master authoring surface', () => {
  it('exposes fixed master elements as editable while retaining their stored lock contract', () => {
    const { result } = renderHook(useHarness)

    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))

    expect(result.current.masterEdit.fixedElements[0].locked).toBe(false)
    expect(result.current.presentation.layoutMasters[0].fixedElements[0].locked).toBe(true)
  })

  it('deletes a master element from the selected layout only', () => {
    const { result } = renderHook(useHarness)

    act(() => result.current.openLayoutManager())
    act(() => result.current.layoutManagerProps.onEditMaster('layout-1'))
    act(() => result.current.deleteMasterElement('band'))

    expect(result.current.presentation.layoutMasters[0].fixedElements).toEqual([])
  })

  it('keeps an unresolved detached target disabled and publishes a repair notice', () => {
    const notices = []
    const listener = (event) => notices.push(event.detail)
    window.addEventListener('navslides:feedback', listener)
    try {
      const initial = {
        slides: [{ id: 'slide', layoutId: 'layout', elements: [{ id: 'missing', type: 'text' }] }],
        layoutMasters: [
          {
            id: 'layout',
            name: 'Master',
            placeholders: [],
            fixedElements: [
              {
                id: 'button',
                type: 'shape',
                x: 0,
                y: 0,
                width: 120,
                height: 60,
                action: { kind: 'show', targetElementId: 'missing' },
              },
            ],
          },
        ],
      }
      const { result } = renderHook(() => useHarness(initial))
      act(() => result.current.detachActiveLayout())
      const detached = result.current.presentation.slides[0]
      expect(detached.layoutId).toBeUndefined()
      expect(detached.elements[0].action.referenceError).toBeTruthy()
      expect(detached.elements[0]).toMatchObject({ type: 'shape', locked: false })
      expect(detached.elements[0].id).not.toBe('button')
      expect(detached.elements[0].action.targetElementId).toBe('missing')
      const state = createInteractionSlideState(detached)
      const disabled = executeInteractionAction(state, detached.elements[0].action)
      expect(disabled.state).toBe(state)
      expect(disabled.error).toBe(detached.elements[0].action.referenceError)
      expect(initial.layoutMasters[0].fixedElements[0].action.targetElementId).toBe('missing')
      expect(notices).toContainEqual(
        expect.objectContaining({
          type: 'notice',
          message: expect.stringMatching(/choose|target/i),
        })
      )
    } finally {
      window.removeEventListener('navslides:feedback', listener)
    }
  })
})
