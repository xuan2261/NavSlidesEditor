import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorSelectionController } from './use-editor-selection-controller'

function createController(elements, selectedIds, overrides = {}) {
  return {
    selectedElementIdsRef: { current: selectedIds },
    activeSlideRef: { current: { id: 'slide-1', elements } },
    updateElement: vi.fn(),
    updateElements: vi.fn(),
    replaceElementZOrder: vi.fn(),
    notifyBlockedAction: vi.fn(),
    setSelectedElementIds: vi.fn(),
    ...overrides,
  }
}

describe('useEditorSelectionController update transactions', () => {
  it('keeps a batch-derived multi-selection update on updateElements when one type is compatible', () => {
    const controller = createController(
      [
        { id: 'image-1', type: 'image', x: 0, y: 0, width: 100, height: 100 },
        { id: 'html-1', type: 'html', x: 120, y: 0, width: 100, height: 100 },
      ],
      ['image-1', 'html-1']
    )
    const { result } = renderHook(() => useEditorSelectionController(controller))

    act(() => result.current.updateSelectedElements({ borderRadius: 12 }))

    expect(controller.updateElements).toHaveBeenCalledWith([{ id: 'image-1', borderRadius: 12 }])
    expect(controller.updateElement).not.toHaveBeenCalled()
  })

  it('uses updateElement for a single selected compatible element', () => {
    const controller = createController(
      [{ id: 'image-1', type: 'image', x: 0, y: 0, width: 100, height: 100 }],
      ['image-1']
    )
    const { result } = renderHook(() => useEditorSelectionController(controller))

    act(() => result.current.updateSelectedElements({ borderRadius: 12 }))

    expect(controller.updateElement).toHaveBeenCalledWith('image-1', { borderRadius: 12 })
    expect(controller.updateElements).not.toHaveBeenCalled()
  })

  it('updates selected master elements from the active authoring surface', () => {
    const masterSlide = {
      id: 'master:layout-1',
      elements: [{ id: 'master-image', type: 'image', width: 100, height: 100 }],
    }
    const controller = createController([], ['master-image'], {
      getSelectionSlide: () => masterSlide,
    })
    const { result } = renderHook(() => useEditorSelectionController(controller))

    act(() => result.current.updateSelectedElements({ borderRadius: 12 }))

    expect(controller.updateElement).toHaveBeenCalledWith('master-image', { borderRadius: 12 })
  })

  it('batches compatible master updates from the active authoring surface', () => {
    const masterSlide = {
      id: 'master:layout-1',
      elements: [
        { id: 'master-a', type: 'image', width: 100, height: 100 },
        { id: 'master-b', type: 'image', width: 100, height: 100 },
      ],
    }
    const controller = createController([], ['master-a', 'master-b'], {
      getSelectionSlide: () => masterSlide,
    })
    const { result } = renderHook(() => useEditorSelectionController(controller))

    act(() => result.current.updateSelectedElements({ borderRadius: 12 }))

    expect(controller.updateElements).toHaveBeenCalledWith([
      { id: 'master-a', borderRadius: 12 },
      { id: 'master-b', borderRadius: 12 },
    ])
  })

  it('reorders selected master elements from the active authoring surface', () => {
    const masterSlide = {
      id: 'master:layout-1',
      elements: [
        { id: 'master-a', type: 'shape', zIndex: 1 },
        { id: 'master-b', type: 'shape', zIndex: 2 },
      ],
    }
    const controller = createController([], ['master-a'], {
      getSelectionSlide: () => masterSlide,
    })
    const { result } = renderHook(() => useEditorSelectionController(controller))

    act(() => result.current.stepSelectedZOrder('forward'))

    expect(controller.replaceElementZOrder).toHaveBeenCalledTimes(1)
    expect(controller.replaceElementZOrder.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        { id: 'master-a', zIndex: 2 },
        { id: 'master-b', zIndex: 1 },
      ])
    )
  })

  it('expands grouped master selections from the active authoring surface', () => {
    const masterSlide = {
      id: 'master:layout-1',
      elements: [
        { id: 'master-a', type: 'shape', groupId: 'group-1' },
        { id: 'master-b', type: 'shape', groupId: 'group-1' },
      ],
    }
    const controller = createController([], [], {
      getSelectionSlide: () => masterSlide,
    })
    const { result } = renderHook(() => useEditorSelectionController(controller))

    act(() => result.current.toggleElementSelection('master-a'))

    expect(controller.setSelectedElementIds).toHaveBeenCalledWith(['master-a', 'master-b'])
  })
})
