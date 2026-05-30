import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useElementCreation } from './use-element-creation'

function makeDeps(overrides = {}) {
  let presentation = {
    id: 'p1',
    slides: [{ id: 's1', elements: [{ id: 'e0', type: 'callout', calloutNumber: 1 }] }],
  }
  const setPresentation = vi.fn((updater) => {
    presentation = typeof updater === 'function' ? updater(presentation) : updater
  })
  const selected = { ids: [] }
  const setSelectedElementIds = vi.fn((v) => {
    selected.ids = typeof v === 'function' ? v(selected.ids) : v
  })
  // Test mapper: acts on slide index 0 (the only/parent slide).
  const mapActiveSlide = (prev, fn) =>
    prev ? { ...prev, slides: prev.slides.map((s, i) => (i === 0 ? fn(s) : s)) } : prev
  return {
    getPresentation: () => presentation,
    getSelected: () => selected.ids,
    deps: {
      mapActiveSlide,
      getActiveSlide: () => presentation.slides[0],
      setPresentation,
      setSelectedElementIds,
      updateElement: vi.fn(),
      htmlEditorState: null,
      setHtmlEditorState: vi.fn(),
      codeEditorState: null,
      setCodeEditorState: vi.fn(),
      latexEditorState: null,
      setLatexEditorState: vi.fn(),
      ...overrides,
    },
  }
}

beforeEach(() => {
  if (!globalThis.crypto) globalThis.crypto = {}
  if (!globalThis.crypto.randomUUID) {
    let n = 0
    globalThis.crypto.randomUUID = () => `uuid-${++n}`
  }
})

describe('useElementCreation', () => {
  it('addElement appends a text element with defaults and selects it', () => {
    const { getPresentation, getSelected, deps } = makeDeps()
    const { result } = renderHook(() => useElementCreation(deps))
    act(() => {
      result.current.addElement('text')
    })
    const slide = getPresentation().slides[0]
    const added = slide.elements[slide.elements.length - 1]
    expect(added.type).toBe('text')
    expect(getSelected()).toEqual([added.id])
  })

  it('addShapeElement centers a 200x200 circle', () => {
    const { getPresentation, deps } = makeDeps()
    const { result } = renderHook(() => useElementCreation(deps))
    act(() => {
      result.current.addShapeElement('circle')
    })
    const els = getPresentation().slides[0].elements
    const shape = els[els.length - 1]
    expect(shape.type).toBe('shape')
    expect(shape.shape).toBe('circle')
    expect(shape.width).toBe(200)
    expect(shape.height).toBe(200)
    expect(shape.x).toBe((960 - 200) / 2)
    expect(shape.y).toBe((540 - 200) / 2)
  })

  it('addCalloutElement auto-numbers from existing callouts', () => {
    const { getPresentation, deps } = makeDeps()
    const { result } = renderHook(() => useElementCreation(deps))
    act(() => {
      result.current.addCalloutElement()
    })
    const els = getPresentation().slides[0].elements
    const callout = els[els.length - 1]
    // seed had one callout (number 1) -> next is 2
    expect(callout.calloutNumber).toBe(2)
  })

  it('addHtmlElement appends an html element and opens the html editor', () => {
    const setHtmlEditorState = vi.fn()
    const { deps } = makeDeps({ setHtmlEditorState })
    const { result } = renderHook(() => useElementCreation(deps))
    act(() => {
      result.current.addHtmlElement()
    })
    expect(setHtmlEditorState).toHaveBeenCalledWith(
      expect.objectContaining({ elementId: expect.any(String), content: expect.any(String) })
    )
  })

  it('addGameElement uses the game factory and selects it', () => {
    const { getPresentation, getSelected, deps } = makeDeps()
    const { result } = renderHook(() => useElementCreation(deps))
    act(() => {
      result.current.addGameElement('jeopardy')
    })
    const els = getPresentation().slides[0].elements
    const game = els[els.length - 1]
    expect(game.type).toBe('game')
    expect(game.gameType).toBe('jeopardy')
    expect(getSelected()).toEqual([game.id])
  })

  it('insertEmbedHtml appends an html element with the given content', () => {
    const { getPresentation, deps } = makeDeps()
    const { result } = renderHook(() => useElementCreation(deps))
    act(() => {
      result.current.insertEmbedHtml('<div>embed</div>')
    })
    const els = getPresentation().slides[0].elements
    const embed = els[els.length - 1]
    expect(embed.type).toBe('html')
    expect(embed.content).toBe('<div>embed</div>')
  })

  it('exposes pluginTypes (array)', () => {
    const { deps } = makeDeps()
    const { result } = renderHook(() => useElementCreation(deps))
    expect(Array.isArray(result.current.pluginTypes)).toBe(true)
  })
})
