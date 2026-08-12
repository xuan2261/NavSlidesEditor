import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function createLiveSlide(id, label, notes, children = []) {
  return {
    id,
    elements: [
      {
        id: `${id}-text`,
        type: 'text',
        x: 80,
        y: 100,
        width: 760,
        height: 160,
        zIndex: 1,
        content: `<h2>${label}</h2>`,
      },
    ],
    notes,
    background: { type: 'color', color: '#1e1e2e' },
    children,
  }
}

async function createRoom(request) {
  const res = await request.post('/api/live/room')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.presenterToken).toBeTruthy()
  expect(body.remoteToken).toBeTruthy()
  expect(body.speakerToken).toBeTruthy()
  return body
}

async function openPresenter(context, presId, roomCode, presenterToken) {
  const page = await context.newPage()
  await page.goto('about:blank')
  await page.evaluate(
    ({ code, token }) => {
      window.name = JSON.stringify({ roomCode: code, presenterToken: token })
    },
    { code: roomCode, token: presenterToken }
  )
  await page.goto(`/api/presentations/${presId}/present?live=${roomCode}`)
  await expect(page.locator('body')).toBeVisible()
  return page
}

async function waitForRevealIndex(page, title, expected) {
  const iframe = page.locator(`iframe[title="${title}"]`)
  await expect(iframe).toBeVisible({ timeout: 15000 })
  const handle = await iframe.elementHandle()
  const frame = await handle.contentFrame()
  expect(frame).toBeTruthy()

  await expect
    .poll(
      async () => {
        return frame.evaluate(() => {
          const reveal = window.Reveal
          if (!reveal || !reveal.isReady?.()) return null
          const indices = reveal.getIndices()
          return `${indices.h || 0}:${indices.v || 0}:${indices.f || 0}`
        })
      },
      { timeout: 15000 }
    )
    .toBe(expected)
}

test.describe('Live Presentation & WebSockets', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Live Test')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('can create a live room via API', async ({ request }) => {
    const res = await request.post('/api/live/room')
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.roomCode).toBeTruthy()
    expect(data.presenterToken).toBeTruthy()
  })

  test('can open Present Live button and see modal', async ({ page }) => {
    const editor = new EditorPage(page)
    await editor.gotoPresentation(presId)

    await editor.startBroadcast()

    await expect(page.getByRole('dialog', { name: 'Present Live' })).toBeVisible()
  })

  test('live room URL contains room code', async ({ page }) => {
    const editor = new EditorPage(page)
    await editor.gotoPresentation(presId)

    await editor.startBroadcast()

    // Check that the room code input exists
    const roomInput = page.locator('input[readonly]').first()
    const value = await roomInput.inputValue()
    expect(value).toContain('/live/')
  })

  test('present live modal shows room code and both share links', async ({ page }) => {
    const editor = new EditorPage(page)
    await editor.gotoPresentation(presId)

    await editor.startBroadcast()

    await expect(page.locator('text=Room Code')).toBeVisible()
    await expect(page.locator('text=Viewer')).toBeVisible()
    await expect(page.locator('text=Remote')).toBeVisible()
    await expect(page.getByText('Speaker', { exact: true })).toBeVisible()

    const readonlyInputs = page.locator('input[readonly]')
    await expect(readonlyInputs).toHaveCount(3)
    await expect(readonlyInputs.nth(0)).toHaveValue(/\/live\//)
    await expect(readonlyInputs.nth(1)).toHaveValue(/\/remote\//)
    await expect(readonlyInputs.nth(2)).toHaveValue(/\/speaker\//)
  })

  test('remote controller navigates viewer without increasing viewer count', async ({
    context,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        createLiveSlide('slide-a', 'Slide A', 'Notes A'),
        createLiveSlide('slide-b', 'Slide B', 'Notes B'),
      ],
    })
    const room = await createRoom(request)
    await openPresenter(context, presId, room.roomCode, room.presenterToken)

    const viewer = await context.newPage()
    await viewer.goto(`/live/${room.roomCode}`)
    await waitForRevealIndex(viewer, 'Live Presentation', '0:0:0')

    const remote = await context.newPage()
    await remote.setViewportSize({ width: 390, height: 844 })
    await remote.goto(`/remote/${room.roomCode}#cap=${room.remoteToken}`)
    await expect(remote.getByText('No speaker notes for this slide.')).toBeVisible({ timeout: 10000 })
    await expect(remote.getByTestId('remote-viewer-count')).toContainText('1')
    await remote.getByRole('button', { name: /Next/ }).click()
    await waitForRevealIndex(viewer, 'Live Presentation', '1:0:0')
    await expect(remote.getByText('No speaker notes for this slide.')).toBeVisible({ timeout: 10000 })
    await expect(remote.getByTestId('remote-viewer-count')).toContainText('1')
  })

  test('speaker view stacks and scrolls at narrow desktop widths', async ({ page, request }) => {
    const room = await createRoom(request)
    await page.setViewportSize({ width: 640, height: 700 })
    await page.goto(`/speaker/${room.roomCode}#cap=${room.speakerToken}`)

    const main = page.getByTestId('speaker-main')
    const previews = page.getByTestId('speaker-previews')
    const notes = page.getByTestId('speaker-notes')
    await expect(main).toBeVisible()

    const previewBox = await previews.boundingBox()
    const notesBox = await notes.boundingBox()
    expect(notesBox.y).toBeGreaterThanOrEqual(previewBox.y + previewBox.height)
    expect(await main.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640)
  })

})
