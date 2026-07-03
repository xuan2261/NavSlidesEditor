import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAiActions } from './use-ai-actions'

function makeDeps(initial) {
  let presentation = initial
  const setPresentation = vi.fn((updater) => {
    presentation = typeof updater === 'function' ? updater(presentation) : updater
  })
  const updateElement = vi.fn((id, updates) => {
    presentation = {
      ...presentation,
      slides: presentation.slides.map((s) => ({
        ...s,
        elements: (s.elements || []).map((el) => (el.id === id ? { ...el, ...updates } : el)),
      })),
    }
  })
  return {
    get: () => presentation,
    deps: { presentation, setPresentation, updateElement, selectedElementId: 'e1' },
  }
}

beforeEach(() => {
  if (!globalThis.crypto) globalThis.crypto = {}
  if (!globalThis.crypto.randomUUID) {
    let n = 0
    globalThis.crypto.randomUUID = () => `uuid-${++n}`
  }
})

describe('useAiActions', () => {
  it('onCreatePresentation appends locally-built slides (no fetch)', () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const { get, deps } = makeDeps({ id: 'p', slides: [{ id: 's1', elements: [] }] })
    const { result } = renderHook(() => useAiActions(deps))
    act(() => {
      result.current.onCreatePresentation([
        { title: 'A', layout: 'content', bulletPoints: ['x'] },
      ])
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(get().slides).toHaveLength(2)
  })

  it('onCreatePresentation inherits the current deck slide theme context', () => {
    const { get, deps } = makeDeps({
      id: 'p',
      slides: [
        {
          id: 's1',
          background: { type: 'gradient', gradient: 'linear-gradient(90deg, red, blue)' },
          designTokens: { colors: { accent: '#ff7a18', bg: '#101828' } },
          elements: [],
        },
      ],
    })
    const { result } = renderHook(() => useAiActions(deps))
    act(() => {
      result.current.onCreatePresentation([{ title: 'A', layout: 'content', bulletPoints: ['x'] }])
    })
    const generated = get().slides[1]
    expect(generated.background).toEqual({ type: 'gradient', gradient: 'linear-gradient(90deg, red, blue)' })
    expect(generated.designTokens).toEqual({ colors: { accent: '#ff7a18', bg: '#101828' } })
  })

  it('onAICopywriterApply wraps text and updates the selected element', () => {
    const { get, deps } = makeDeps({
      id: 'p',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>old</p>' }] }],
    })
    const { result } = renderHook(() => useAiActions(deps))
    act(() => {
      result.current.onAICopywriterApply('brand new')
    })
    const el = get().slides[0].elements[0]
    expect(el.content).toBe('<p>brand new</p>')
  })

  it('onApplyTranslations writes translated element content', () => {
    const { get, deps } = makeDeps({
      id: 'p',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>hello</p>' }] }],
    })
    const { result } = renderHook(() => useAiActions(deps))
    act(() => {
      result.current.onApplyTranslations({ '0-0-content': { translatedHtml: '<p>bonjour</p>' } }, false)
    })
    expect(get().slides[0].elements[0].content).toBe('<p>bonjour</p>')
  })

  it('SECURITY: onApplyTranslations sanitizes a script/onerror payload before writing content', () => {
    const { get, deps } = makeDeps({
      id: 'p',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>hi</p>' }] }],
    })
    const { result } = renderHook(() => useAiActions(deps))
    act(() => {
      result.current.onApplyTranslations(
        { '0-0-content': { translatedHtml: '<p onclick="evil()">x</p><script>alert(1)</script>' } },
        false
      )
    })
    const content = get().slides[0].elements[0].content
    expect(content).not.toContain('<script>')
    expect(content).not.toContain('onclick')
  })
})
