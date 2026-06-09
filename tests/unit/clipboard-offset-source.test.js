import { describe, expect, it } from 'vitest'
import {
  createPasteOperation,
  createDuplicateOperation,
} from '../../client/src/hooks/use-clipboard.js'

// A pasted/duplicated copy must never land exactly on top of its source, or the
// copy is invisible. Paste additionally cascades on repeat so a burst of pastes
// fans out instead of stacking at one point.
describe('clipboard offset contract', () => {
  const source = [{ id: 'a', x: 100, y: 100, width: 50, height: 50 }]

  it('first paste offsets the copy off the original by +20/+20', () => {
    const { elements } = createPasteOperation({ clipboardElements: source, pasteIndex: 0 })
    expect(elements[0].x).toBe(120)
    expect(elements[0].y).toBe(120)
  })

  it('repeated paste cascades instead of overlapping', () => {
    const first = createPasteOperation({ clipboardElements: source, pasteIndex: 0 })
    const second = createPasteOperation({ clipboardElements: source, pasteIndex: 1 })
    expect(second.elements[0].x).toBeGreaterThan(first.elements[0].x)
    expect(second.elements[0].y).toBeGreaterThan(first.elements[0].y)
  })

  it('duplicate offsets the copy off the original by +20/+20', () => {
    const { toAdd } = createDuplicateOperation({
      slideElements: source,
      selectedElementIds: ['a'],
    })
    expect(toAdd[0].x).toBe(120)
    expect(toAdd[0].y).toBe(120)
  })
})
