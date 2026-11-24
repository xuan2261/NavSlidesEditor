import { expect } from '@playwright/test'
import { decodePdf, decodePptx } from './release-static-artifacts.js'

export async function setTeacherReveal(page, reveal) {
  await page.getByLabel('File menu', { exact: true }).click()
  const checkbox = page.getByRole('menuitemcheckbox', {
    name: 'Include answers in PDF / reconstructed PPTX',
    exact: true,
  })
  await expect(checkbox).toHaveAttribute('aria-checked', 'false')
  if (reveal) {
    await checkbox.press('Enter')
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('note')).toContainText(/Answer keys will be visible/)
    await expect(page.getByRole('note')).toContainText(/Do not distribute/)
  }
  await page.keyboard.press('Escape')
}
export async function exportStatic(page, format, testInfo, suffix, expectWarning = true) {
  await page.getByLabel('File menu', { exact: true }).click()
  if (format === 'pdf') {
    const popupPending = page.waitForEvent('popup')
    await page.getByRole('menuitem', { name: 'Export PDF', exact: true }).click()
    const popup = await popupPending
    try {
      await popup.waitForLoadState('load')
      await popup.evaluate(() => document.fonts.ready)
      await popup.waitForFunction(() => [...document.images].every((image) => image.complete))
      const file = testInfo.outputPath(`${suffix}.pdf`)
      await popup.pdf({ path: file, printBackground: true, preferCSSPageSize: true })
      const observed = await decodePdf(file, testInfo.outputPath(`${suffix}-pdf-page`))
      return { ...observed, warning: await popup.locator('body').innerText(), file }
    } finally {
      await popup.close()
    }
  }
  const downloadPending = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export PPTX', exact: true }).click()
  const download = await downloadPending
  expect(await download.failure()).toBeNull()
  const file = testInfo.outputPath(`${suffix}.pptx`)
  await download.saveAs(file)
  const observed = await decodePptx(file, testInfo.outputPath(`${suffix}-pptx-media`))
  const notice = page.getByRole('dialog').filter({ hasText: 'PPTX export completed with warnings' })
  let warning = ''
  if (expectWarning) {
    await expect(notice).toBeVisible()
    warning = await notice.innerText()
    await notice.getByRole('button', { name: /^OK$|^Close$/ }).click()
  }
  return { ...observed, warning, file }
}
