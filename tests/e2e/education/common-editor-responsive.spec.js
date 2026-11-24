import { test, expect } from '../fixtures/test-fixtures.js'
import {
  commonSession,
  selectCommon,
  commonInspector,
  commonTry,
  targetable,
  commonObservation,
  captureCommon,
} from './common-editor.js'

async function pageGeometry(page) {
  return page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    htmlWidth: document.documentElement.clientWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }))
}

for (const width of [320, 768, 1280]) {
  test(`common responsive-${width} native game authoring and Try controls remain reachable`, async ({
    page,
    request,
    testPresentation,
  }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const s = await commonSession(page, request, testPresentation.id)
    const canvasBounds = await targetable(s.target)
    await selectCommon(s.target)
    const panel = await commonInspector(page, width)
    const item = panel.getByRole('textbox', { name: 'Item 1 label', exact: true })
    const inputBounds = await targetable(item)
    const label = `Learner ${width}`
    await item.fill(label)
    await item.press('Tab')
    const authored = structuredClone(s.original[0])
    authored['name-picker'].items[0].label = label
    await expect.poll(s.read).toEqual([authored])
    const authoredPage = await pageGeometry(page)
    expect(authoredPage).toMatchObject({ width, height: 900, htmlWidth: width, bodyWidth: width })
    expect(authoredPage.htmlScrollWidth).toBeLessThanOrEqual(width + 1)
    expect(authoredPage.bodyScrollWidth).toBeLessThanOrEqual(width + 1)
    await page.reload()
    await s.editor.waitForReady()
    expect(await s.read()).toEqual([authored])
    await selectCommon(s.target)
    const reloadedPanel = await commonInspector(page, width)
    await expect(
      reloadedPanel.getByRole('textbox', { name: 'Item 1 label', exact: true })
    ).toHaveValue(label)
    const launcherBounds = await targetable(
      reloadedPanel.getByRole('button', { name: 'Try game', exact: true })
    )
    const { launcher, dialog, root } = await commonTry(page, reloadedPanel)
    const modal = dialog.getByTestId('modal-shell-dialog')
    const modalBounds = await targetable(modal)
    const overflow = await modal.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)
    const mode = root.getByRole('combobox', { name: 'Picker mode', exact: true })
    const modeBounds = await targetable(mode)
    await mode.selectOption('dice')
    await expect(root.locator('.ns-picker-dice svg')).toHaveCount(
      s.fixture['name-picker'].diceCount
    )
    const pick = root.locator('[data-ns-command="pick"]')
    const pickBounds = await targetable(pick)
    await pick.click()
    await expect(root.locator('[data-ns-winner]')).toHaveText(label)
    const winnerBounds = await targetable(root.locator('[data-ns-winner]'))
    const completed = await root.innerText()
    const resetControl = root.getByRole('button', { name: 'Reset', exact: true })
    const resetBounds = await targetable(resetControl)
    await resetControl.click()
    await expect(root.locator('[data-ns-winner]')).toHaveText('Choose a name')
    await expect(mode).toHaveValue('button')
    const reset = await root.innerText()
    const playablePage = await pageGeometry(page)
    expect(playablePage.width).toBe(width)
    expect(playablePage.htmlScrollWidth).toBeLessThanOrEqual(width + 1)
    expect(playablePage.bodyScrollWidth).toBeLessThanOrEqual(width + 1)
    expect(await s.read()).toEqual([authored])
    const gameArtifact = await captureCommon(info, page, `common-responsive-${width}-native-reset`)
    const closeBounds = await targetable(
      dialog.getByRole('button', { name: 'Close Try game', exact: true })
    )
    await dialog.getByRole('button', { name: 'Close Try game', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    if (width < 1280) {
      await launcher.press('Escape')
      await expect(page.getByRole('dialog', { name: 'Inspector', exact: true })).toHaveCount(0)
    }
    const returnedCanvasBounds = await targetable(s.target)
    const returnedPage = await pageGeometry(page)
    expect(returnedPage.htmlScrollWidth).toBeLessThanOrEqual(width + 1)
    expect(returnedPage.bodyScrollWidth).toBeLessThanOrEqual(width + 1)
    await commonObservation(
      info,
      page,
      `responsive-${width}`,
      {
        viewport: { width, height: 900 },
        savedLabel: label,
        winner: label,
        resetWinner: 'Choose a name',
        maximumPageWidth: width + 1,
        resetMode: 'button',
      },
      {
        authoredPage,
        playablePage,
        returnedPage,
        persisted: await s.read(),
        completed,
        reset,
        overflow,
        bounds: {
          canvasBounds,
          inputBounds,
          launcherBounds,
          modalBounds,
          modeBounds,
          pickBounds,
          winnerBounds,
          resetBounds,
          closeBounds,
          returnedCanvasBounds,
        },
      },
      [gameArtifact]
    )
  })
}
