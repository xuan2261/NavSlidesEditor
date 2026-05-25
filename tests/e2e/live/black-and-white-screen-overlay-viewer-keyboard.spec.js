import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { waitWithLastSample } from '../helpers/playwright-tolerant-poll-wait-helpers-for-live-presentation-e2e.js'

const SLIDES = [
  { id: 'slide-1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>BW Screen</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
]

test.describe('Black and white screen overlay viewer keyboard toggle', () => {
  let presId, roomCode

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'BW Screen E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
    const roomRes = await request.post('/api/live/room')
    const room = await roomRes.json()
    roomCode = room.roomCode
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  async function openViewer(page) {
    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })
    await page.locator('body').click({ position: { x: 5, y: 5 } })
  }

  test('pressing B toggles a fullscreen black overlay on viewer', async ({ page }) => {
    await openViewer(page)

    const overlay = page.locator('div[style*="background-color: rgb(0, 0, 0)"][style*="z-index: 99999"]')
    await expect(overlay).toHaveCount(0)

    await page.keyboard.press('B')
    await waitWithLastSample(
      'black overlay visible after B',
      async () => (await page.locator('div[style*="background-color: rgb(0, 0, 0)"][style*="z-index: 99999"]').count()) === 1
    )

    await page.keyboard.press('Escape')
    await waitWithLastSample(
      'black overlay dismissed after Escape',
      async () => (await page.locator('div[style*="background-color: rgb(0, 0, 0)"][style*="z-index: 99999"]').count()) === 0
    )
  })

  test('pressing W toggles a fullscreen white overlay on viewer', async ({ page }) => {
    await openViewer(page)

    const whiteSelector = 'div[style*="background-color: rgb(255, 255, 255)"][style*="z-index: 99999"]'
    await expect(page.locator(whiteSelector)).toHaveCount(0)

    await page.keyboard.press('W')
    await waitWithLastSample(
      'white overlay visible after W',
      async () => (await page.locator(whiteSelector).count()) === 1
    )

    await page.locator(whiteSelector).first().click()
    await waitWithLastSample(
      'white overlay dismissed after click',
      async () => (await page.locator(whiteSelector).count()) === 0
    )
  })

  test('clicking the black overlay dismisses it', async ({ page }) => {
    await openViewer(page)
    await page.keyboard.press('B')
    const blackSelector = 'div[style*="background-color: rgb(0, 0, 0)"][style*="z-index: 99999"]'
    await waitWithLastSample('black overlay visible', async () => (await page.locator(blackSelector).count()) === 1)
    await page.locator(blackSelector).first().click()
    await waitWithLastSample('black overlay dismissed', async () => (await page.locator(blackSelector).count()) === 0)
  })
})
