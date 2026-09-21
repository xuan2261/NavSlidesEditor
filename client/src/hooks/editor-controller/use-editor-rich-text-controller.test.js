import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

let mockEditor

vi.mock('@tiptap/react', () => ({
  useEditor: () => mockEditor,
}))

import { useEditorRichTextController } from './use-editor-rich-text-controller'

// A destroyed TipTap editor (e.g. one torn down by @tiptap/react's deferred
// scheduleDestroy before React commits the mounted tree) is still a truthy
// object, but reading `editor.commands` throws because `commandManager` is
// nulled in `destroy()`.
function destroyedEditor() {
  return {
    isDestroyed: true,
    get commands() {
      throw new TypeError("Cannot read properties of null (reading 'commands')")
    },
  }
}

function useHarness(props = {}) {
  const ref = (value) => ({ current: value })
  return useEditorRichTextController({
    presentation: {
      slides: [{ id: 's1', elements: [{ id: 'el-1', type: 'text', content: '<p>hi</p>' }] }],
    },
    setPresentation: vi.fn(),
    mapActive: (prev, _fn) => prev,
    activeSlideRef: ref({ id: 's1', elements: [{ id: 'el-1', type: 'text' }] }),
    currentSlideIndexRef: ref(0),
    editingElementId: null,
    editingElementIdRef: ref(null),
    setEditingElementId: vi.fn(),
    setSelectedElementIds: vi.fn(),
    setActiveTab: vi.fn(),
    getElement: (_active, slide, id) => slide?.elements.find((e) => e.id === id),
    exitEditOnEscape: vi.fn(),
    ...props,
  })
}

describe('useEditorRichTextController with a destroyed editor', () => {
  it('clearContent does not touch editor.commands when the editor is destroyed', () => {
    mockEditor = destroyedEditor()
    const { result } = renderHook(() => useHarness())

    expect(() => act(() => result.current.clearContent())).not.toThrow()
  })

  it('startEditingElement does not touch editor.commands when the editor is destroyed', () => {
    mockEditor = destroyedEditor()
    const { result } = renderHook(() => useHarness())

    expect(() => act(() => result.current.startEditingElement('el-1'))).not.toThrow()
  })
})

describe('useEditorRichTextController with a live editor', () => {
  it('clearContent forwards setContent to the editor', () => {
    const setContent = vi.fn()
    mockEditor = { isDestroyed: false, commands: { setContent } }
    const { result } = renderHook(() => useHarness())

    act(() => result.current.clearContent())

    expect(setContent).toHaveBeenCalledWith('', false)
  })
})
