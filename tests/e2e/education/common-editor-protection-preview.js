import { expect } from '../fixtures/test-fixtures.js'
import { geometry, captureCommon } from './common-editor.js'

export async function inspectAlignedPreview(page, s, aligned, changedGeometry, other, panel, info) {
  await page.reload()
  await s.editor.waitForReady()
  expect(await s.read()).toEqual(aligned)
  expect(await geometry(s.target)).toEqual(changedGeometry)
  expect(await geometry(other)).toMatchObject({ x: 120, y: 300, width: 200, height: 140 })
  await selectCommon(s.target)
  await expect(panel.getByTestId('prop-fragment-index')).toHaveValue('2')
  await expect(panel.getByRole('combobox', { name: 'Element action', exact: true })).toHaveValue(
    'next'
  )

  await page.getByRole('tab', { name: 'Animations', exact: true }).click()
  await page.getByRole('button', { name: 'Preview animation', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Animation Preview', exact: true })
  await expect(preview).toBeVisible()
  const fragment = preview
    .frameLocator('iframe[title="Animation Preview"]')
    .locator(`.fragment[data-ns-element-id="${s.fixture.id}"]`)
  await expect(fragment).toHaveCount(1)
  await expect(preview).toContainText('Initial state')
  await expect(fragment).toBeHidden()
  const readFragment = () =>
    fragment.evaluate((node) => ({
      index: node.getAttribute('data-fragment-index'),
      opacity: getComputedStyle(node).opacity,
      visibility: getComputedStyle(node).visibility,
      classes: node.className,
    }))
  const initialFragment = await readFragment()
  await preview.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(fragment).toBeVisible()
  await expect(fragment).toHaveCSS('opacity', '1')
  await expect(preview).toContainText('Fragment 2')
  const revealedFragment = await readFragment()
  const fragmentArtifact = await captureCommon(info, page, 'common-fragment-revealed')
  await preview.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(fragment).toBeHidden()
  const replayedFragment = await readFragment()
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  expect(await s.read()).toEqual(aligned)
  return { initialFragment, revealedFragment, replayedFragment, fragmentArtifact }
}
