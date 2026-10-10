import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { answerQuestion } from './release-quiz-interactions.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { recordCommon } from './common-runtime-evidence.js'

const inheritedId = 'layout-fixed:lesson:inherited'
const rootFor = (page, slide, element) =>
  page.locator(
    `[data-ns-effective-slide-id="${slide}"] [data-ns-game][data-ns-element-id="${element}"]`
  )
const stateOf = (root) =>
  root.evaluate((node) => {
    const state = window.NavSlidesEducation.mount(node).getState()
    return {
      status: state.status,
      score: state.score,
      questionIndex: state.questionIndex,
      generation: state.generation,
    }
  })
async function current(page, h, v, id) {
  await page.evaluate(({ h, v }) => window.Reveal.slide(h, v), { h, v })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        indices: window.Reveal.getIndices(),
        slide: window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId,
      }))
    )
    .toMatchObject({ indices: { h, v }, slide: id })
}
async function finish(root, question) {
  await answerQuestion(root, question)
  await expect(root).toContainText('Score: 10')
  await root.getByRole('button', { name: 'Finish quiz', exact: true }).click()
  await expect(root.getByRole('status')).toHaveText('Quiz complete.')
  expect(await stateOf(root)).toMatchObject({ status: 'complete', score: 10 })
}

test('common tuple-isolation: generated master and vertical native instances retain independent progress across leave/return', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const local = {
    ...gameFixture('quiz', 'single-choice'),
    id: 'local',
    x: 20,
    y: 20,
    width: 430,
    height: 500,
  }
  local.quiz.questions[0].prompt = 'Local tuple question'
  const inherited = { ...structuredClone(local), id: 'inherited', x: 510 }
  inherited.quiz.questions[0].prompt = 'Inherited tuple question'
  await apiUpdatePresentation(request, testPresentation.id, {
    ...deckWith([]),
    layoutMasters: [{ id: 'lesson', name: 'Lesson', fixedElements: [inherited], placeholders: [] }],
    slides: [
      {
        id: 'parent',
        layoutId: 'lesson',
        elements: [local],
        children: [{ id: 'child', layoutId: 'lesson', elements: [] }],
      },
      { id: 'second', layoutId: 'lesson', elements: [] },
    ],
  })
  await new EditorPage(page).gotoPresentation(testPresentation.id)
  const { popup } = await launchPresentPopup(page)
  try {
    await popup.waitForFunction(() => window.Reveal?.isReady())
    await current(popup, 0, 0, 'parent')
    const parentLocal = rootFor(popup, 'parent', 'local')
    const parentInherited = rootFor(popup, 'parent', inheritedId)
    const childInherited = rootFor(popup, 'child', inheritedId)
    const secondInherited = rootFor(popup, 'second', inheritedId)
    await expect(
      parentLocal.getByRole('heading', { name: local.quiz.questions[0].prompt, exact: true })
    ).toBeVisible()
    await expect(
      parentInherited.getByRole('heading', {
        name: inherited.quiz.questions[0].prompt,
        exact: true,
      })
    ).toBeVisible()
    await finish(parentLocal, local.quiz.questions[0])
    await expect(parentInherited).toContainText('Score: 0')
    await expect(
      parentInherited.getByRole('button', { name: 'Submit answer', exact: true })
    ).toBeEnabled()
    const afterLocal = await Promise.all(
      [parentLocal, parentInherited, childInherited, secondInherited].map(stateOf)
    )
    expect(afterLocal.map((state) => state.score)).toEqual([10, 0, 0, 0])
    await current(popup, 0, 1, 'child')
    await expect(parentLocal).toHaveClass(/ns-education-paused/)
    await expect(childInherited).toBeVisible()
    await finish(childInherited, inherited.quiz.questions[0])
    const afterChild = await Promise.all(
      [parentLocal, parentInherited, childInherited, secondInherited].map(stateOf)
    )
    expect(afterChild.map((state) => state.score)).toEqual([10, 0, 10, 0])
    await current(popup, 1, 0, 'second')
    await expect(secondInherited).toContainText('Score: 0')
    await expect(
      secondInherited.getByRole('button', { name: 'Submit answer', exact: true })
    ).toBeEnabled()
    await current(popup, 0, 0, 'parent')
    await expect(parentLocal.getByRole('status')).toHaveText('Quiz complete.')
    await expect(parentLocal).not.toHaveClass(/ns-education-paused/)
    await parentLocal.getByRole('button', { name: 'Reset quiz', exact: true }).click()
    await expect(parentLocal).toContainText('Score: 0')
    await expect(
      parentLocal.getByRole('button', { name: 'Submit answer', exact: true })
    ).toBeEnabled()
    const afterReset = await Promise.all(
      [parentLocal, parentInherited, childInherited, secondInherited].map(stateOf)
    )
    expect(afterReset.map((state) => state.score)).toEqual([0, 0, 10, 0])
    expect(afterReset[0].generation).toBe(afterLocal[0].generation + 1)
    await current(popup, 0, 1, 'child')
    await expect(childInherited.getByRole('status')).toHaveText('Quiz complete.')
    const returned = await childInherited.innerText()
    await recordCommon(
      testInfo,
      popup,
      'tuple-isolation',
      'present',
      {
        afterLocalScores: [10, 0, 0, 0],
        afterChildScores: [10, 0, 10, 0],
        afterParentResetScores: [0, 0, 10, 0],
        returnedChildStatus: 'Quiz complete.',
        currentSlide: 'child',
        currentIndices: { h: 0, v: 1 },
      },
      {
        afterLocal,
        afterChild,
        afterReset,
        returned,
        current: await popup.evaluate(() => ({
          slide: window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId,
          indices: window.Reveal.getIndices(),
        })),
      }
    )
  } finally {
    await popup.close()
  }
})
