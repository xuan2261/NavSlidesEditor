import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { authorHistory, savedElements } from './release-author-history.js'
import { playUtility } from './release-utility-interactions.js'
import { fieldEvidence } from './release-visual-fields.js'

test('generic native game config persists, edit canvas stays inert, and Try modal plays authored content', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const fixture = gameFixture('name-picker')
  fixture['name-picker'].items[0].label = 'Initial picker name'
  await apiUpdatePresentation(request, testPresentation.id, deckWith([fixture]))
  const original = (await savedElements(request, testPresentation.id))[0]
  const expected = structuredClone(original)
  expected['name-picker'].items[0].label = 'Authored winner'
  const history = await authorHistory(
    page,
    request,
    testPresentation.id,
    original,
    async (page) => {
      await page.getByRole('textbox', { name: 'Item 1 label', exact: true }).fill('Authored winner')
      await page.getByTestId('canvas-area').click({ position: { x: 10, y: 10 } })
    },
    expected
  )
  const canvas = page.getByTestId(`slide-element-${fixture.id}`)
  await canvas.focus()
  await canvas.press('Enter')
  await expect(canvas.getByRole('button')).toHaveCount(0)
  const initialCanvas = await canvas.textContent()
  await canvas.click({ position: { x: 10, y: 10 } })
  for (const key of ['Enter', 'Space']) {
    await canvas.press(key)
    await expect.poll(() => canvas.textContent()).toBe(initialCanvas)
  }
  expect((await savedElements(request, testPresentation.id))[0]['name-picker']).toEqual(
    expected['name-picker']
  )
  await expect(page.getByRole('dialog', { name: 'Try game', exact: true })).toHaveCount(0)
  await fieldEvidence(
    info,
    page,
    'game',
    ['editInert'],
    { authorCanvasDoesNotPick: true, configUnchanged: true, noPlayableCanvasButtons: true },
    {
      beforeText: initialCanvas,
      afterText: await canvas.textContent(),
      persistedConfig: (await savedElements(request, testPresentation.id))[0]['name-picker'],
      canvasButtons: await canvas.getByRole('button').count(),
    }
  )
  await page.getByRole('button', { name: 'Try game', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
  await expect(dialog).toBeVisible()
  const result = await playUtility(
    dialog.locator('[data-ns-game]'),
    'name-picker',
    expected['name-picker']
  )
  expect(result.completed).toContain('Authored winner')
  expect(result.reset).toContain('Choose a name')
  const saved = (await savedElements(request, testPresentation.id))[0]
  expect(saved['name-picker']).toEqual(expected['name-picker'])
  await fieldEvidence(
    info,
    page,
    'game',
    ['config', 'tryPlayable'],
    {
      authoredWinner: 'Authored winner',
      savedConfigRetained: true,
      playableOnlyInTry: true,
      resetReady: true,
    },
    {
      reloaded: history.reloaded,
      clone: history.cloned,
      actualConfig: saved['name-picker'],
      completed: result.completed,
      reset: result.reset,
    }
  )
  await dialog.getByRole('button', { name: /^Close/ }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => canvas.textContent()).toBe(initialCanvas)
})
