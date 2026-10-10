import { afterEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { generateRevealHTML } from '../src/htmlGenerator.js'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'
import { validatePublicGameConfig } from '../src/education/game-public-validation.js'
import { actualEducationDocument as actualDocument } from './helpers/education-document.js'
const documents = []
afterEach(() => {
  for (const dom of documents.splice(0)) dom.window.close()
})
const game = (id, type = 'name-picker', patch = {}) => ({
  id,
  type: 'game',
  gameType: type,
  x: 0,
  y: 0,
  width: 640,
  height: 480,
  [type]: { ...createDefaultGameConfig(type), ...patch },
})
const deck = (elements) => ({
  id: 'native-deck',
  title: 'Native lesson',
  resolution: { width: 960, height: 540 },
  slides: [{ id: 'first', elements }],
})

describe('generated document native runtime', () => {
  it('loads the actual IIFE through generated asset URLs and plays each effective inherited root independently', async () => {
    const presentation = deck([])
    presentation.layoutMasters = [
      {
        id: 'lesson',
        name: 'Lesson',
        placeholders: [],
        fixedElements: [game('master', 'name-picker', { animationDuration: 0 })],
      },
    ]
    presentation.slides = [
      {
        id: 'first',
        layoutId: 'lesson',
        elements: [],
        children: [{ id: 'child', layoutId: 'lesson', elements: [] }],
      },
      { id: 'second', layoutId: 'lesson', elements: [] },
      {
        id: 'hidden',
        layoutId: 'lesson',
        layoutOverrides: { elementPatches: { master: { hidden: true } } },
        elements: [],
      },
    ]
    const dom = await actualDocument(presentation),
      { document, NavSlidesEducation, Reveal } = dom.window
    const roots = [...document.querySelectorAll('[data-ns-game]')]
    expect(
      roots.map((root) => [
        root.closest('[data-ns-effective-slide-id]').dataset.nsEffectiveSlideId,
        root.dataset.nsElementId,
      ])
    ).toEqual([
      ['first', 'layout-fixed:lesson:master'],
      ['child', 'layout-fixed:lesson:master'],
      ['second', 'layout-fixed:lesson:master'],
    ])
    const first = NavSlidesEducation.mount(roots[0]),
      child = NavSlidesEducation.mount(roots[1]),
      second = NavSlidesEducation.mount(roots[2])
    roots[0].querySelector('[data-ns-command="pick"]').click()
    expect(first.getState().picks).toBe(1)
    Reveal.slide(0, 1)
    roots[1].querySelector('[data-ns-command="pick"]').click()
    expect(child.getState().picks).toBe(1)
    expect(second.getState().picks).toBe(0)
    Reveal.slide(0, 0)
    expect(first.getState().picks).toBe(1)
    child.reset()
    expect(child.getState().picks).toBe(0)
    expect(first.getState().picks).toBe(1)
  })
  it('serializes public live configs without supplying matcher keys, while local config remains intentionally inspectable', () => {
    const question = createDefaultGameConfig('quiz').questions[0]
    question.feedback.explanation = 'PRIVATE_TEACHER_EXPLANATION'
    const presentation = deck([game('quiz', 'quiz', { questions: [question] })])
    const audience = new JSDOM(generateRevealHTML(presentation, { educationView: 'audience' }))
    const local = new JSDOM(generateRevealHTML(presentation))
    documents.push(audience, local)
    const publicConfig = JSON.parse(
      audience.window.document.querySelector('[data-ns-game-config]').textContent
    )
    expect(validatePublicGameConfig('quiz', publicConfig).isValid).toBe(true)
    expect(publicConfig.questions[0].answerKey).toBeUndefined()
    expect(publicConfig.questions[0].feedback).toBeUndefined()
    expect(
      JSON.parse(local.window.document.querySelector('[data-ns-game-config]').textContent)
        .questions[0].answerKey
    ).toEqual(question.answerKey)
  })
})
