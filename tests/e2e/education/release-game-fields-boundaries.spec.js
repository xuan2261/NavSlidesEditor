import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { savedElements } from './release-author-history.js'
import { click, label } from './release-game-fields-harness.js'

for (const { type, control, value } of [
  { type: 'four-corners', control: 'Corner count', value: '2' },
  { type: 'scoreboard', control: 'Minimum score', value: '1000001' },
])
  test(`${type} incompatible inspector draft is rejected at save and Try without coercing authored collections`, async ({
    page,
    request,
    testPresentation,
  }) => {
    const fixture = gameFixture(type)
    await apiUpdatePresentation(request, testPresentation.id, deckWith([fixture]))
    const original = (await savedElements(request, testPresentation.id))[0]
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    await page.getByTestId(`slide-element-${fixture.id}`).click({ position: { x: 5, y: 5 } })
    const panel = page.getByRole('tabpanel', { name: 'Content game properties', exact: true })
    await label(panel, control).fill(value)
    await expect(panel.getByRole('alert').first()).toBeVisible()
    await expect(label(panel, control)).toHaveValue(value)
    await expect(
      page.getByRole('toolbar', { name: 'Quick actions', exact: true }).getByRole('alert')
    ).toBeVisible()
    expect((await savedElements(request, testPresentation.id))[0]).toEqual(original)
    await click(page, 'Try game')
    const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.locator('[data-ns-game-ui] button')).toHaveCount(0)
    await dialog.getByRole('button', { name: /^Close/ }).click()
    await page.reload()
    await editor.waitForReady()
    const recovery = page.getByRole('alertdialog', {
      name: 'Recover interrupted save',
      exact: true,
    })
    await expect(recovery).toBeVisible()
    await recovery.getByRole('button', { name: 'Use Remote', exact: true }).click()
    await expect(recovery).toBeHidden()
    await page.getByTestId(`slide-element-${fixture.id}`).click({ position: { x: 5, y: 5 } })
    await expect(label(panel, control)).toHaveValue(
      String(original[type][type === 'four-corners' ? 'cornerCount' : 'minScore'])
    )
    expect((await savedElements(request, testPresentation.id))[0]).toEqual(original)
  })
