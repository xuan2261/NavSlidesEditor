import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { INTERACTIVE_DECK_SLIDES, buildEducationDeckPayload } from './fixtures/interactive-deck.js'
import { slideElement } from '../pages/canvas-actions-helper.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup, launchPresentSlidePopup } from './present-offline-helpers.js'
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

  test('Image longDescription edited across multiple selected images persists to both (Expected RED)', async ({
    page,
    request,
  }) => {
    await editor.gotoPresentation(presId)
    await editor.selectSlide(1) // Slide 2: Dual Images

    const img1 = slideElement(page, 'image-fanout-primary')
    const img2 = slideElement(page, 'image-fanout-secondary')
    await img1.waitFor({ state: 'visible', timeout: 15000 })

    await img1.click()
    await img2.click({ modifiers: ['Shift'] })
    await expect(page.locator('.properties-panel')).toContainText('2 elements selected')

    const longDescInput = page.getByLabel('Image long description')
    await expect(longDescInput).toBeVisible()
    await longDescInput.fill('Updated accessible description applied to all selected images')
    await longDescInput.blur()

    await editor.waitForAutoSave()
    await page.reload()
    await editor.waitForReady()

    const saved = await apiGetPresentation(request, presId)
    const dualSlide = saved.slides.find((s) => s.id === 'slide-dual-images')
    const primaryImg = dualSlide.elements.find((el) => el.id === 'image-fanout-primary')
    const secondaryImg = dualSlide.elements.find((el) => el.id === 'image-fanout-secondary')

    expect(primaryImg.longDescription).toBe(
      'Updated accessible description applied to all selected images'
    )
    expect(secondaryImg.longDescription).toBe(
      'Updated accessible description applied to all selected images'
    )
  })

  test('Normal Present popup: Name Picker interactive play and winner selection (Expected RED)', async ({
    page,
  }) => {
    await editor.gotoPresentation(presId)
    const pickerSlideIdx = INTERACTIVE_DECK_SLIDES.findIndex((s) => s.id === 'slide-game-picker')
    await editor.selectSlide(pickerSlideIdx)

    const { popup, url } = await launchPresentSlidePopup(page, pickerSlideIdx)
    expect(url).toContain(`/api/presentations/${presId}/present`)

    try {
      const spinButton = popup.locator(
        '.reveal section.present [data-ns-game-type="name-picker"] [data-ns-command="pick"]'
      )
      await expect(spinButton).toBeVisible({ timeout: 3000 })

      await spinButton.click()
      const winnerElement = popup.locator(
        '.reveal section.present [data-ns-game-type="name-picker"] [data-ns-winner]'
      )
      await expect(winnerElement).toBeVisible({ timeout: 5000 })
      await expect(winnerElement).toHaveText(/^(Alice|Bob|Charlie|Diana|Evan)$/, { timeout: 5000 })
      const winnerText = await winnerElement.textContent()
      expect(['Alice', 'Bob', 'Charlie', 'Diana', 'Evan']).toContain(winnerText?.trim())
    } finally {
      await popup.close()
    }
  })

  test('Normal Present popup: Hot Potato multi-question feedback and progression (Expected RED)', async ({
    page,
  }) => {
    await editor.gotoPresentation(presId)
    const hpSlideIdx = INTERACTIVE_DECK_SLIDES.findIndex((s) => s.id === 'slide-game-hot-potato')
    await editor.selectSlide(hpSlideIdx)

    const { popup, url } = await launchPresentSlidePopup(page, hpSlideIdx)
    expect(url).toContain(`/api/presentations/${presId}/present`)

    try {
      const game = popup.locator('.reveal section.present [data-ns-game-type="hot-potato"]')
      await expect(game).toBeVisible({ timeout: 3000 })
      await game
        .getByRole('textbox', { name: 'Participant ID', exact: true })
        .fill('baseline-learner')
      await game
        .getByRole('textbox', { name: 'Participant name', exact: true })
        .fill('Baseline learner')
      await game.locator('[data-ns-command="add-participant"]').click()
      await game.locator('[data-ns-command="start"]').click()
      await game.getByRole('radio', { name: 'Au', exact: true }).check()
      await game.locator('[data-ns-command="submit-answer"]').click()
      await expect(game.getByRole('status')).toContainText(/Correct[.!]/)
      await game.locator('[data-ns-command="reveal"]').click()
      await game.locator('[data-ns-command="next"]').click()

      const secondQuestion = game.getByRole('heading', {
        name: /Which planet is known as the Red Planet\?/,
      })
      await expect(secondQuestion).toBeVisible({ timeout: 4000 })
    } finally {
      await popup.close()
    }
  })

  test('Normal Present popup: Vertical child slide navigation and game identity', async ({
    page,
  }) => {
    await editor.gotoPresentation(presId)
    const verticalIndex = INTERACTIVE_DECK_SLIDES.findIndex((s) => s.id === 'slide-vertical-parent')
    await editor.selectSlide(verticalIndex)

    const { popup, url } = await launchPresentPopup(page)
    try {
      await popup.goto(`${url}#/${verticalIndex}`)
      await popup.waitForFunction(() => window.Reveal?.isReady())
      await expect
        .poll(() => popup.evaluate(() => Reveal.getIndices()))
        .toMatchObject({ h: verticalIndex, v: 0 })

      await popup.keyboard.press('ArrowDown')
      await expect
        .poll(() => popup.evaluate(() => Reveal.getIndices()))
        .toMatchObject({ h: verticalIndex, v: 1 })

      const childSection = popup.locator('.reveal section.present.stack section.present')
      await expect(childSection).toBeVisible()
      await expect(childSection).toHaveAttribute(
        'data-ns-effective-slide-id',
        'slide-vertical-child-1'
      )
      const nestedGame = childSection.locator('[data-ns-game-type="name-picker"]')
      await expect(nestedGame).toBeAttached()
    } finally {
      await popup.close()
    }
  })

  test('Normal Present popup: Multiple game blocks on same slide observe respective identities', async ({
    page,
  }) => {
    await editor.gotoPresentation(presId)
    const multiSlideIdx = INTERACTIVE_DECK_SLIDES.findIndex((s) => s.id === 'slide-multi-games')
    await editor.selectSlide(multiSlideIdx)

    const { popup } = await launchPresentSlidePopup(page, multiSlideIdx)
    try {
      const pollBlock = popup.locator('.reveal section.present [data-ns-game-type="poll"]')
      const wordCloudBlock = popup.locator(
        '.reveal section.present [data-ns-game-type="word-cloud"]'
      )
      await expect(pollBlock).toBeAttached()
      await expect(wordCloudBlock).toBeAttached()
    } finally {
      await popup.close()
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
