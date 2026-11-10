export { shape, config, openPreview, saveSnapshot }
import { expect } from '../fixtures/test-fixtures.js'
const shape = (id, x, y) => ({
  id,
  name: id,
  type: 'shape',
  shape: 'rect',
  x,
  y,
  width: 170,
  height: 80,
  fill: '#22c55e',
  zIndex: 1,
})
const config = ({ slides, layoutMasters, resolution, theme, transition, presenterTools }) => ({
  slides,
  layoutMasters,
  resolution,
  theme,
  transition,
  presenterTools,
})

async function openPreview(page) {
  await page.getByRole('tab', { name: 'Animations', exact: true }).click()
  await page.getByRole('button', { name: 'Preview animation', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Animation Preview', exact: true })
  await expect(dialog).toBeVisible()
  const iframe = dialog.locator('iframe[title="Animation Preview"]')
  await expect
    .poll(() =>
      iframe.evaluate((node) => {
        const deck = node.contentWindow?.Reveal
        return Boolean(deck?.isReady() && deck.getConfig().keyboard === false)
      })
    )
    .toBe(true)
  return { dialog, iframe, frame: dialog.frameLocator('iframe[title="Animation Preview"]') }
}

async function saveSnapshot(editor, page, name) {
  await editor.clickQuickAccessSave()
  await editor.openHistoryModal()
  const history = page.getByRole('dialog', { name: 'Version History', exact: true })
  await history.getByPlaceholder('Snapshot name (optional)').fill(name)
  await history.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(history.getByText(name, { exact: true })).toBeVisible()
  await history.getByRole('button', { name: 'Close Version History', exact: true }).click()
}
