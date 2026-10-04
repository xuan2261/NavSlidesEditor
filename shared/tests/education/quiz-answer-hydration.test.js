// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { createQuizAnswerControls } from '../../src/education/browser/quiz-answer-controls.js'

function controls(kind) {
  const question = createCanonicalQuestion({ id: 'q', kind })
  const cleanups = []
  const session = { getState: () => ({ generation: 0 }), own: (fn) => cleanups.push(fn) }
  const input = createQuizAnswerControls({ document, question, session })
  document.body.append(input.element)
  return {
    ...input,
    close: () => {
      cleanups.reverse().forEach((fn) => fn())
      input.element.remove()
    },
  }
}

describe('canonical answer hydration for live reconnect', () => {
  it.each([
    ['single-choice', { optionId: 'q/option-2' }],
    ['multi-choice', { optionIds: ['q/option-1', 'q/option-2'] }],
    ['true-false', { value: false }],
    ['fill-blank', { text: 'Unsubmitted draft' }],
    ['ordering', { itemIds: ['q/option-2', 'q/option-1'] }],
    ['matching', { pairs: [{ leftId: 'q/left-1', rightId: 'q/right-1' }] }],
    ['image-hotspot', { mode: 'point', x: 0.15, y: 0.9 }],
    ['image-hotspot', { mode: 'region', regionId: 'q/option-2' }],
  ])('restores %s without replacing controls or grading', (kind, answer) => {
    const input = controls(kind)
    const child = input.element.firstChild
    expect(input.setAnswer(answer)).toBe(true)
    expect(input.getAnswer()).toEqual(answer)
    expect(input.element.firstChild).toBe(child)
    input.close()
  })
  it('restores partial matching drafts but rejects unknown or duplicate targets atomically', () => {
    const input = controls('matching')
    expect(input.setAnswer({ pairs: [] })).toBe(true)
    expect(input.setAnswer({ pairs: [{ leftId: 'q/left-1', rightId: 'unknown' }] })).toBe(false)
    expect(input.getAnswer()).toEqual({ pairs: [] })
    input.close()
  })
  it('rejects invalid ordering permutations without altering the previous draft', () => {
    const input = controls('ordering')
    const before = input.getAnswer()
    expect(input.setAnswer({ itemIds: ['q/option-1', 'q/option-1'] })).toBe(false)
    expect(input.getAnswer()).toEqual(before)
    input.close()
  })
  it('rejects nonfinite/out-of-image hydration rather than selecting a phantom point', () => {
    const input = controls('image-hotspot')
    const before = input.getAnswer()
    expect(input.setAnswer({ mode: 'point', x: Infinity, y: 0.5 })).toBe(false)
    expect(input.getAnswer()).toEqual(before)
    input.close()
  })
})
