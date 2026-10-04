import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useElementCreation } from './use-element-creation'

const local = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }
const provenance = { presetId: 'logic-gate', sourceId: 'logic-gate/lesson' }
function editor(element) {
  let deck = { slides: [{ id: 'lesson', elements: [element] }] },
    state = null,
    writes = 0
  const deps = {
    getActiveSlide: () => deck.slides[0],
    mapActiveSlide: (prev, fn) => ({ ...prev, slides: prev.slides.map(fn) }),
    setPresentation: (updater) => {
      deck = updater(deck)
    },
    setSelectedElementIds: vi.fn(),
    setHtmlEditorState: (value) => {
      state = value
    },
    updateElement: (id, patch) => {
      writes++
      deck = {
        ...deck,
        slides: deck.slides.map((slide) => ({
          ...slide,
          elements: slide.elements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),
      }
    },
    htmlEditorState: null,
    setCodeEditorState: vi.fn(),
    setLatexEditorState: vi.fn(),
  }
  const hook = renderHook(() => useElementCreation({ ...deps, htmlEditorState: state }))
  return {
    hook,
    deck: () => deck,
    state: () => state,
    writes: () => writes,
    reopen() {
      deck = JSON.parse(JSON.stringify(deck))
      act(() => hook.result.current.openHtmlEditor(element.id))
      hook.rerender()
    },
  }
}

describe('HTML Apply persisted metadata transaction', () => {
  it('saves declaration and unchanged built-in provenance together and reopens them from saved JSON', () => {
    const session = editor({
      id: 'embed',
      type: 'html',
      content: '<button>Local</button>',
      sourceMetadata: provenance,
    })
    session.reopen()
    act(() =>
      session.hook.result.current.commitHtmlEdit({ ...session.state(), htmlDependencies: local })
    )
    expect(session.writes()).toBe(1)
    session.reopen()
    expect(session.state().htmlDependencies).toEqual(local)
    expect(session.state().sourceMetadata).toEqual(provenance)
    expect(session.state().content).toBe('<button>Local</button>')
  })
  it('clears built-in provenance when source changes even if the supplied state retained it', () => {
    const session = editor({
      id: 'embed',
      type: 'html',
      content: '<p>Built-in</p>',
      htmlDependencies: local,
      sourceMetadata: provenance,
    })
    session.reopen()
    act(() =>
      session.hook.result.current.commitHtmlEdit({ ...session.state(), content: '<p>Authored</p>' })
    )
    session.reopen()
    expect(session.state().content).toBe('<p>Authored</p>')
    expect(session.state().sourceMetadata).toBeUndefined()
    expect(session.state().htmlDependencies).toEqual(local)
    expect(session.writes()).toBe(1)
  })
})
