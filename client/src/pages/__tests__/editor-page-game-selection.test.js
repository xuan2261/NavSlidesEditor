import { describe, expect, it } from 'vitest'
import { getGameElementForActiveSlide } from '../editor-page-helpers.js'
import { fixedId } from 'revealjs-shared'
const game = (id) => ({ id, type: 'game', gameType: 'poll', x: 0, y: 0, width: 400, height: 300 })
const master = {
  id: 'lesson',
  name: 'Lesson',
  placeholders: [],
  fixedElements: [game('inherited')],
}

describe('active effective game selection', () => {
  it('selects the visible selected game and excludes a hidden selection from fallback', () => {
    const source = {
      elements: [game('first'), { ...game('hidden'), hidden: true }, game('selected')],
    }
    expect(getGameElementForActiveSlide(source, null, 'selected').id).toBe('selected')
    expect(getGameElementForActiveSlide(source, null, 'hidden').id).toBe('first')
    expect(
      getGameElementForActiveSlide(
        { elements: [{ ...game('hidden'), hidden: true }] },
        null,
        'hidden'
      )
    ).toBeNull()
  })
  it('resolves inherited effective IDs and their selected overrides without changing authored data', () => {
    const source = {
      id: 'slide',
      layoutId: 'lesson',
      elements: [game('owned')],
      layoutOverrides: { elementPatches: { inherited: { poll: { prompt: 'Override' } } } },
    }
    const before = structuredClone({ source, master })
    const selected = getGameElementForActiveSlide(source, null, fixedId('lesson', 'inherited'), [
      master,
    ])
    expect(selected.id).toBe(fixedId('lesson', 'inherited'))
    expect(selected.poll.prompt).toBe('Override')
    expect({ source, master }).toEqual(before)
  })
  it.each(['inherited', fixedId('lesson', 'inherited')])(
    'excludes inherited games hidden by %s',
    (id) => {
      const source = {
        layoutId: 'lesson',
        elements: [],
        layoutOverrides: { hiddenElementIds: [id] },
      }
      expect(
        getGameElementForActiveSlide(source, null, fixedId('lesson', 'inherited'), [master])
      ).toBeNull()
    }
  )
  it('excludes patched-hidden inherited games and does not borrow a parent game for an empty active child', () => {
    const parent = { elements: [game('parent')] }
    const child = {
      layoutId: 'lesson',
      elements: [],
      layoutOverrides: { elementPatches: { inherited: { hidden: true } } },
    }
    expect(getGameElementForActiveSlide(child, parent, 'parent', [master])).toBeNull()
    expect(getGameElementForActiveSlide({ elements: [] }, parent)).toBeNull()
    expect(getGameElementForActiveSlide(null, parent).id).toBe('parent')
  })
})
