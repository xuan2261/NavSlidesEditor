import { describe, expect, it, vi } from 'vitest'
import { certifyImmutableSemanticDocument } from 'revealjs-shared/src/pptx-semantic-records.js'
import { cloneHistorySnapshot } from './editor-history-snapshot'

const deck = (pptxSemantic) => ({
  title: 'Original',
  slides: [{ id: 'slide', elements: [{ id: 'text', style: { color: 'red' } }] }],
  settings: { nested: ['original'] },
  pptxSemantic,
})

describe('history snapshot ownership', () => {
  it.each(['raw', 'shallow frozen', 'deep frozen but uncertified'])('copies %s semantic children', (kind) => {
    const child = { payload: { values: ['original'] } }
    if (kind === 'deep frozen but uncertified') {
      Object.freeze(child.payload.values)
      Object.freeze(child.payload)
    }
    if (kind !== 'raw') Object.freeze(child)
    const source = deck(child)
    const snapshot = cloneHistorySnapshot(source)
    expect(snapshot).toEqual(source)
    expect(snapshot.pptxSemantic).not.toBe(child)
    snapshot.pptxSemantic.payload.values[0] = 'snapshot mutation'
    expect(child.payload.values[0]).toBe('original')
    if (kind !== 'deep frozen but uncertified') {
      child.payload.values.push('source mutation')
      expect(snapshot.pptxSemantic.payload.values).toEqual(['snapshot mutation'])
    }
  })

  it('shares only certified semantics, without serializing them, and isolates every mutable shell', () => {
    const child = certifyImmutableSemanticDocument(Object.freeze({
      payload: Object.freeze({ large: 'x'.repeat(10 * 1024 * 1024) }),
    }))
    const source = deck(child)
    const stringify = vi.spyOn(JSON, 'stringify')
    let snapshot
    try {
      snapshot = cloneHistorySnapshot(source)
      expect(stringify).toHaveBeenCalledTimes(1)
      expect(stringify.mock.calls[0][0]).not.toHaveProperty('pptxSemantic')
    } finally {
      stringify.mockRestore()
    }
    const published = cloneHistorySnapshot(snapshot)
    expect(snapshot.pptxSemantic).toBe(child)
    expect(published.pptxSemantic).toBe(child)
    source.slides[0].elements[0].style.color = 'blue'
    published.slides[0].elements[0].style.color = 'green'
    published.settings.nested.push('consumer')
    expect(snapshot.slides[0].elements[0].style.color).toBe('red')
    expect(snapshot.settings.nested).toEqual(['original'])
    expect(() => { published.pptxSemantic.payload.large = 'forged' }).toThrow(TypeError)
  })
})
