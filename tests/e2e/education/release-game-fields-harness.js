import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { savedElements } from './release-author-history.js'
import { observe } from './release-observations.js'

export const label = (root, name) => root.getByLabel(name, { exact: true })
export const click = (root, name) => root.getByRole('button', { name, exact: true }).click()
export function scalar(field, name, value, exercise, setup = () => {}) {
  return {
    field,
    setup,
    change: (config) => {
      config[field] = value
    },
    author: (panel) =>
      typeof value === 'boolean'
        ? label(panel, name).setChecked(value)
        : typeof value === 'number'
          ? label(panel, name).fill(String(value))
          : label(panel, name).fill(value),
    exercise,
  }
}
export function select(field, name, value, exercise, setup) {
  const result = scalar(field, name, value, exercise, setup)
  result.author = (panel) => label(panel, name).selectOption(value)
  return result
}
export function nested(field, name, value, change, exercise, setup = () => {}) {
  return { ...scalar(field, name, value, exercise, setup), change }
}
export async function participant(root, name = 'Field learner', id = 'field-learner') {
  const identity = root.getByRole('textbox', { name: 'Participant ID', exact: true })
  if (await identity.count()) await identity.fill(id)
  await label(root, 'Participant name').fill(name)
  await click(root, 'Add participant')
  await expect(
    root.getByRole('combobox', { name: 'Current participant', exact: true })
  ).toContainText(name)
}
export async function wrongAnswer(root, question) {
  const option = question.options.find((item) => item.id !== question.answerKey.optionId)
  await root.locator(`input[value="${option.id}"]`).check()
  await click(root, 'Submit answer')
}
export async function reset(root, name = 'Reset') {
  await click(root, name)
}
export function defineFields(type, cases) {
  for (const entry of cases)
    test(`[cap:game.${type}.editor] ${type} inspector field:${entry.field} save/reload native outcome`, async ({
      page,
      request,
      testPresentation,
    }, testInfo) => {
      test.setTimeout(90000)
      const fixture = gameFixture(type)
      const inactive = type === 'countdown' ? 'memory' : 'countdown'
      fixture[inactive] = gameFixture(inactive)[inactive]
      entry.setup(fixture[type], fixture)
      const initialField = structuredClone(fixture[type][entry.field])
      await apiUpdatePresentation(request, testPresentation.id, {
        ...deckWith([fixture]),
        ...entry.deckProperties,
      })
      const original = (await savedElements(request, testPresentation.id))[0]
      const expected = structuredClone(original)
      entry.change(expected[type])
      expect(
        expected[type][entry.field],
        'The reachable author control must change this field'
      ).not.toEqual(initialField)
      const editor = new EditorPage(page)
      await editor.gotoPresentation(testPresentation.id)
      const target = page.getByTestId(`slide-element-${fixture.id}`)
      await target.click({ position: { x: 5, y: 5 } })
      const baseline = entry.beforeAuthor ? await entry.beforeAuthor(page) : null
      if (entry.field === 'title')
        await page.getByRole('tab', { name: 'Display', exact: true }).click()
      const panel = page.getByRole('tabpanel', {
        name: entry.field === 'title' ? 'Display game properties' : 'Content game properties',
        exact: true,
      })
      await entry.author(panel, page)
      await page.getByTestId('canvas-area').click({ position: { x: 10, y: 10 } })
      await expect.poll(() => savedElements(request, testPresentation.id)).toEqual([expected])
      await page.reload()
      await editor.waitForReady()
      const persisted = (await savedElements(request, testPresentation.id))[0]
      expect(persisted).toEqual(expected)
      expect(persisted[inactive]).toEqual(original[inactive])
      await target.click({ position: { x: 5, y: 5 } })
      await click(page, 'Try game')
      const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
      const root = dialog.locator('[data-ns-game]')
      await expect(root).toBeVisible()
      const nativeObservation = await entry.exercise(root, persisted[type], {
        page,
        panel,
        original: original[type],
        baseline,
      })
      const nativeText = await root.innerText()
      await observe(
        testInfo,
        page,
        { element: 'game', gameType: type, questionKind: null, surface: 'editor' },
        `field:${entry.field}`,
        {
          field: entry.field,
          authoredValue: expected[type][entry.field],
          nativeOutcome:
            entry.outcome || 'Explicit native behavioral assertions following inspector mutation',
        },
        {
          field: entry.field,
          persistedValue: persisted[type][entry.field],
          nativeText,
          baseline,
          ...(nativeObservation ? { nativeObservation } : {}),
        }
      )
    })
}
export function titleCase(type) {
  return scalar('title', 'Game title', `Edited ${type} classroom`, async (root, config) => {
    await expect(root.getByRole('heading', { name: config.title, exact: true })).toBeVisible()
  })
}
export async function authoredQuestion(panel, page) {
  await click(panel, 'Edit question 1')
  const modal = page.getByRole('dialog', { name: 'Edit Question', exact: true })
  await label(modal, 'Question text').fill('Edited capital question')
  await click(modal, 'Save')
}
export const changeQuestion = (config) => {
  config.questions[0].prompt = 'Edited capital question'
}
export const questionCase = (exercise) => ({
  field: 'questions',
  setup: () => {},
  change: changeQuestion,
  author: authoredQuestion,
  exercise,
})
