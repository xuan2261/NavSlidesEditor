import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorLayoutController } from './use-editor-layout-controller'

const initialPresentation = {
  slides: [{ id: 'slide-1', elements: [] }],
  layoutMasters: [
    {
      id: 'layout-1',
      name: 'Custom master',
      fixedElements: [{ id: 'band', type: 'shape', locked: true }],
      placeholders: [],
    },
  ],
}

function useHarness() {
  const [presentation, setPresentation] = useState(initialPresentation)
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
})
