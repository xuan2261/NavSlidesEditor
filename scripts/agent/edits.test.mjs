import { describe, expect, it } from 'vitest'
import { applyEdits, requireGeneration } from './edits.mjs'

const deck = () => ({ slides: [
  { id: 's1', notes: 'Keep my notes', elements: [{ id: 'e1', type: 'text', x: 40, y: 40, width: 500, height: 100, content: '<p>Original</p>' }], children: [{ id: 'c1', elements: [] }] },
  { id: 's2', background: { type: 'color', color: '#123456' }, elements: [] },
] })

describe('agent atomic deck edits', () => {
  it('moves within sibling positions while preserving slide content and unrelated metadata', () => {
    const original = deck()
    const result = applyEdits(original, [{ op: 'move_slide', slideId: 's1', to: 2 }])
    expect(result.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(result[1].elements[0].content).toBe('<p>Original</p>')
    expect(result[1].notes).toBe('Keep my notes')
    expect(result[0].background).toEqual({ type: 'color', color: '#123456' })
    expect(original.slides.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('targets a nested child by ID without changing its parent or adjacent slide', () => {
    const result = applyEdits(deck(), [
      { op: 'add_element', slideId: 'c1', element: { id: 'e2', type: 'text', content: '<p>Child</p>' } },
      { op: 'update_element', slideId: 'c1', elementId: 'e2', properties: { x: 180 } },
    ])
    expect(result[0].children[0].elements[0]).toMatchObject({ id: 'e2', type: 'text', x: 180, content: '<p>Child</p>' })
    expect(result[0].elements[0].id).toBe('e1')
    expect(result[1].background.color).toBe('#123456')
  })

  it('does not mutate the input when a later operation fails', () => {
    const original = deck()
    expect(() => applyEdits(original, [
      { op: 'update_element', slideId: 's1', elementId: 'e1', properties: { content: 'Not committed' } },
      { op: 'remove_slide', slideId: 'missing' },
    ])).toThrow('was not found')
    expect(original.slides[0].elements[0].content).toBe('<p>Original</p>')
  })

  it('rejects a duplicated element ID across top-level and child slides', () => {
    expect(() => applyEdits(deck(), [{ op: 'add_element', slideId: 'c1', element: { id: 'e1', type: 'image', src: '/uploads/x.png' } }])).toThrow('unique nonempty ID')
  })

  it('rejects identity replacement and out-of-range moves instead of silently retargeting', () => {
    expect(() => applyEdits(deck(), [{ op: 'update_element', slideId: 's1', elementId: 'e1', properties: { id: 'e2' } }])).toThrow('cannot replace')
    expect(() => applyEdits(deck(), [{ op: 'move_slide', slideId: 's1', to: 3 }])).toThrow('within the sibling')
  })

  it('inserts a new vertical child at the requested one-based position', () => {
    const result = applyEdits(deck(), [{ op: 'add_slide', parentSlideId: 's1', at: 1, slide: { id: 'c2', notes: 'Vertical notes', elements: [] } }])
    expect(result[0].children.map((s) => s.id)).toEqual(['c2', 'c1'])
    expect(result[0].children[0].notes).toBe('Vertical notes')
  })

  it('requires the expected generation to match and does not fabricate generation fencing for ordinary decks', () => {
    expect(() => requireGeneration({ aggregateGeneration: 4 }, 3)).toThrow('generation changed')
    expect(() => requireGeneration({}, 1)).toThrow('not generation-backed')
  })
})
