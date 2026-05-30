import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editor-store'

// Multiselect is the store's selection model. Assert the exact accumulation and
// replacement semantics that shift-click / ctrl-click and single-click rely on.
describe('[cap:flow.multiselect tier:deep] selection accumulation semantics', () => {
  beforeEach(() => {
    useEditorStore.setState({ selectedElementIds: [], editingElementId: null })
  })

  it('selectElement replaces the whole selection with one id', () => {
    useEditorStore.getState().addToSelection('a')
    useEditorStore.getState().addToSelection('b')
    useEditorStore.getState().selectElement('c')
    expect(useEditorStore.getState().selectedElementIds).toEqual(['c'])
  })

  it('addToSelection appends ids in click order, preserving sequence', () => {
    useEditorStore.getState().selectElement('a')
    useEditorStore.getState().addToSelection('b')
    useEditorStore.getState().addToSelection('c')
    expect(useEditorStore.getState().selectedElementIds).toEqual(['a', 'b', 'c'])
  })

  it('setSelectedElementIds accepts a functional updater over current selection', () => {
    useEditorStore.getState().setSelectedElementIds(['a', 'b'])
    useEditorStore.getState().setSelectedElementIds((cur) => cur.filter((id) => id !== 'a'))
    expect(useEditorStore.getState().selectedElementIds).toEqual(['b'])
  })

  it('clearSelection empties selection and exits editing together', () => {
    useEditorStore.getState().setSelectedElementIds(['a', 'b', 'c'])
    useEditorStore.getState().startEditing('b')
    useEditorStore.getState().clearSelection()
    expect(useEditorStore.getState().selectedElementIds).toEqual([])
    expect(useEditorStore.getState().editingElementId).toBeNull()
  })
})
