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
  let presId, roomCode, presenterToken

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'BW Screen E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
    const roomRes = await request.post('/api/live/room')
    const room = await roomRes.json()
    roomCode = room.roomCode
    presenterToken = room.presenterToken
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  async function openViewer(page) {
    await page.goto(`/live/${roomCode}`)
    const iframe = page.locator('iframe[title="Live Presentation"]')
    await expect(iframe).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Waiting for presenter...' })).toBeVisible({ timeout: 15000 })
    await iframe.focus()
    await expect(iframe).toBeFocused()
  }

  async function openPresenter(context) {
    const presenter = await context.newPage()
    await presenter.goto('about:blank')
    await presenter.evaluate(({ code, token }) => {
      window.name = JSON.stringify({ roomCode: code, presenterToken: token })
    }, { code: roomCode, token: presenterToken })
    await presenter.goto(`/api/presentations/${presId}/present?live=${roomCode}`)
    await expect(presenter.locator('body')).toBeVisible()
    return presenter
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

    await page.keyboard.press('Escape')
    await waitWithLastSample(
      'white overlay dismissed after Escape',
      async () => (await page.locator(whiteSelector).count()) === 0
    )

    await page.keyboard.press('W')
    await waitWithLastSample(
      'white overlay visible after W again',
      async () => (await page.locator(whiteSelector).count()) === 1
    )

    await page.locator(whiteSelector).first().click()
    await waitWithLastSample(
      'white overlay dismissed after click',
      async () => (await page.locator(whiteSelector).count()) === 0
    )
  })

  test('pressing B, W, and Escape works after the viewer iframe reloads', async ({ page }) => {
    await openViewer(page)

    const iframe = page.locator('iframe[title="Live Presentation"]')
    await iframe.evaluate((element) => {
      element.srcdoc = '<!doctype html><html><body><button type="button">Frame focus</button></body></html>'
    })

    const frame = page.frameLocator('iframe[title="Live Presentation"]')
    const focusTarget = frame.getByRole('button', { name: 'Frame focus' })
    await expect(focusTarget).toBeVisible()
    await focusTarget.focus()
    await expect(iframe).toBeFocused()

    const blackSelector = 'div[style*="background-color: rgb(0, 0, 0)"][style*="z-index: 99999"]'
    const whiteSelector = 'div[style*="background-color: rgb(255, 255, 255)"][style*="z-index: 99999"]'

    await page.keyboard.press('B')
    await waitWithLastSample('black overlay visible after iframe reload', async () => (await page.locator(blackSelector).count()) === 1)
    await page.keyboard.press('Escape')
    await waitWithLastSample('black overlay dismissed after iframe reload', async () => (await page.locator(blackSelector).count()) === 0)

    await page.keyboard.press('W')
    await waitWithLastSample('white overlay visible after iframe reload', async () => (await page.locator(whiteSelector).count()) === 1)
    await page.keyboard.press('Escape')
    await waitWithLastSample('white overlay dismissed after iframe reload', async () => (await page.locator(whiteSelector).count()) === 0)
  })

  test('does not consume viewer shortcut keys from iframe text inputs', async ({ page }) => {
    await openViewer(page)

    const iframe = page.locator('iframe[title="Live Presentation"]')
    await iframe.evaluate((element) => {
      element.srcdoc = '<!doctype html><html><body><input aria-label="Slide input" onkeydown="if (event.key === \'Escape\') { document.body.dataset.escapeHandled = \'true\'; event.preventDefault() }"></body></html>'
    })

    const frame = page.frameLocator('iframe[title="Live Presentation"]')
    const input = frame.getByRole('textbox', { name: 'Slide input' })
    await expect(input).toBeVisible()
    await input.focus()
    await expect(iframe).toBeFocused()

    await page.keyboard.press('B')
    await page.keyboard.press('W')
    await expect(input).toHaveValue('BW')
    await expect(page.locator('div[style*="z-index: 99999"]')).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(frame.locator('body')).toHaveAttribute('data-escape-handled', 'true')
    await expect(page.locator('div[style*="z-index: 99999"]')).toHaveCount(0)
  })

  test('rebinds viewer keyboard shortcuts after the iframe remounts', async ({ page, context }) => {
    await page.route(`**/api/live/room/${roomCode}`, (route) => route.fulfill({ json: { exists: false } }))
    await page.goto(`/live/${roomCode}`)
    await expect(page.getByRole('heading', { name: 'Room not found' })).toBeVisible({ timeout: 15000 })

    const presenter = await openPresenter(context)
    try {
      const iframe = page.locator('iframe[title="Live Presentation"]')
      await expect(iframe).toBeVisible({ timeout: 15000 })
      await expect.poll(async () => (await iframe.getAttribute('srcdoc')) || '', { timeout: 15000 }).toContain('BW Screen')
      await iframe.focus()
      await expect(iframe).toBeFocused()

      const whiteSelector = 'div[style*="background-color: rgb(255, 255, 255)"][style*="z-index: 99999"]'
      await page.keyboard.press('W')
      await waitWithLastSample('white overlay visible after iframe remount', async () => (await page.locator(whiteSelector).count()) === 1)
    } finally {
      await presenter.close()
    }
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
