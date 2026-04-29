import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editor-store'

const initialState = {
  selectedElementIds: [],
  editingElementId: null,
  clipboard: null,
  showGrid: false,
  gridSize: 40,
  smartGuidesEnabled: true,
  showRulers: false,
  guides: [],
  showTimeline: false,
  showFindReplace: false,
  viewMode: 'normal',
}

describe('editor-store', () => {
  beforeEach(() => {
    useEditorStore.setState(initialState)
  })

  it('tracks selection and clears editing state together', () => {
    const store = useEditorStore.getState()

    store.selectElement('el-1')
    useEditorStore.getState().addToSelection('el-2')
    useEditorStore.getState().startEditing('el-2')

    expect(useEditorStore.getState().selectedElementIds).toEqual(['el-1', 'el-2'])
    expect(useEditorStore.getState().editingElementId).toBe('el-2')

    useEditorStore.getState().clearSelection()

    expect(useEditorStore.getState().selectedElementIds).toEqual([])
    expect(useEditorStore.getState().editingElementId).toBeNull()
  })

  it('copies selected elements without preserving IDs', () => {
    const elements = [
      { id: 'a', type: 'text', x: 10 },
      { id: 'b', type: 'shape', x: 20 },
      { id: 'c', type: 'image', x: 30 },
    ]

    useEditorStore.getState().copySelected(elements, ['b', 'c'])

    expect(useEditorStore.getState().clipboard).toEqual([
      { id: undefined, type: 'shape', x: 20 },
      { id: undefined, type: 'image', x: 30 },
    ])
  })

  it('toggles canvas controls and manages persistent guides', () => {
    useEditorStore.getState().toggleGrid()
    useEditorStore.getState().setGridSize((size) => size + 8)
    useEditorStore.getState().toggleSmartGuides()
    useEditorStore.getState().toggleRulers()
    useEditorStore.getState().addGuide({ axis: 'x', position: 120 })
    useEditorStore.getState().addGuide({ axis: 'y', position: 80 })
    useEditorStore.getState().removeGuide(0)

    expect(useEditorStore.getState()).toMatchObject({
      showGrid: true,
      gridSize: 48,
      smartGuidesEnabled: false,
      showRulers: true,
      guides: [{ axis: 'y', position: 80 }],
    })
  })
})
