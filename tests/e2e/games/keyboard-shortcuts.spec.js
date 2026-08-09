import { test, expect } from '../fixtures/test-fixtures.js'
import { GamePage } from '../pages/game-page.js'

test.describe('game keyboard shortcuts', () => {
  test.beforeEach(async ({ page, testPresentation }) => {
    const game = new GamePage(page)
    await game.gotoPresentation(testPresentation.id)
    await game.insertNamePicker()
  })

  test('G toggles HUD visibility', async ({ page }) => {
    const game = new GamePage(page)

    await expect(game.hud).toBeHidden()
    await page.keyboard.press('g')
    await expect(game.hud).toBeVisible()
    await page.keyboard.press('g')
    await expect(game.hud).toBeHidden()
  })

  test('L does not open a leaderboard for a game without leaderboard support', async ({ page }) => {
    const game = new GamePage(page)

    await expect(game.leaderboard).toBeHidden()
    await page.keyboard.press('l')
    await expect(game.leaderboard).toBeHidden()
  })

  test('Enter, R, and P stubs do not open dialogs or throw errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })

    const visibleDialogs = page.locator('[role="dialog"]:visible')
    const before = await visibleDialogs.count()

    await page.keyboard.press('Enter')
    await page.keyboard.press('r')
    await page.keyboard.press('p')

    expect(errors).toEqual([])
    await expect(visibleDialogs).toHaveCount(before)
  })
})
