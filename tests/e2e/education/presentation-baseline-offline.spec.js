import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { INTERACTIVE_DECK_SLIDES, buildEducationDeckPayload } from './fixtures/interactive-deck.js'
import { EditorPage } from '../pages/editor-page.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'

test.describe('Education Baseline — Desired Behavioral Contracts & Failing Regressions', () => {
  let presId
  let editor

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Education Baseline Spec Deck')
    presId = pres.id
    await apiUpdatePresentation(
      request,
      presId,
      buildEducationDeckPayload('Education Baseline Spec Deck')
    )
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    if (presId) {
      await apiDeletePresentation(request, presId)
    }
  })

  test('Offline export: standalone HTML opened as file:// with network blocked allows play (Expected RED)', async ({
    page,
    browser,
  }, testInfo) => {
    await editor.gotoPresentation(presId)
    const file = await downloadArtifact(page, testInfo, 'Export HTML', 'baseline-portable.html')
    const portable = await freshPortable(browser, file)

    try {
      const offlinePage = portable.page
      await offlinePage.waitForSelector('.reveal', { timeout: 15000 })

      const pickerIdx = INTERACTIVE_DECK_SLIDES.findIndex((s) => s.id === 'slide-game-picker')
      await offlinePage.goto(`${offlinePage.url()}#/${pickerIdx}`)
      await offlinePage.waitForSelector('.reveal section.present', { timeout: 15000 })

      const pickBtn = offlinePage.locator(
        '.reveal section.present [data-ns-game-type="name-picker"] [data-ns-command="pick"]'
      )
      await expect(pickBtn).toBeVisible({ timeout: 3000 })
      await pickBtn.click()

      const winner = offlinePage.locator(
        '.reveal section.present [data-ns-game-type="name-picker"] [data-ns-winner]'
      )
      await expect(winner).toBeVisible({ timeout: 5000 })
      await expect(winner).toHaveText(/^(Alice|Bob|Charlie|Diana|Evan)$/, { timeout: 5000 })
      await portable.inspectNetwork()
    } finally {
      await portable.context.close()
    }
  })
})
