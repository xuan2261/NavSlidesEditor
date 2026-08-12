import { test, expect } from '@playwright/test'
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

  test('remote controller follows vertical slide order', async ({ context, request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        createLiveSlide('slide-a', 'Slide A', 'Notes A', [
          createLiveSlide('slide-a-child-1', 'Slide A Child 1', 'Notes A.1'),
          createLiveSlide('slide-a-child-2', 'Slide A Child 2', 'Notes A.2'),
        ]),
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

    await remote.getByRole('button', { name: /Next/ }).click()
    await waitForRevealIndex(viewer, 'Live Presentation', '0:1:0')
    await expect(remote.getByText('No speaker notes for this slide.')).toBeVisible({ timeout: 10000 })

    await remote.getByRole('button', { name: /Next/ }).click()
    await waitForRevealIndex(viewer, 'Live Presentation', '0:2:0')
    await expect(remote.getByText('No speaker notes for this slide.')).toBeVisible({ timeout: 10000 })

    await remote.getByRole('button', { name: /Prev/ }).click()
    await waitForRevealIndex(viewer, 'Live Presentation', '0:1:0')
    await expect(remote.getByText('No speaker notes for this slide.')).toBeVisible({ timeout: 10000 })
  })

  test('speaker view renders notes and thumbnail navigation syncs viewer', async ({
    context,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        createLiveSlide('slide-a', 'Slide A', 'Speaker notes A'),
        createLiveSlide('slide-b', 'Slide B', 'Speaker notes B'),
      ],
    })
    const room = await createRoom(request)
    await openPresenter(context, presId, room.roomCode, room.presenterToken)

    const viewer = await context.newPage()
    await viewer.goto(`/live/${room.roomCode}`)
    await waitForRevealIndex(viewer, 'Live Presentation', '0:0:0')

    const speaker = await context.newPage()
    await speaker.goto(`/speaker/${room.roomCode}#cap=${room.speakerToken}`)
    await expect(speaker.getByText('Speaker notes A')).toBeVisible({ timeout: 10000 })
    await expect(speaker.locator('iframe[title="Current Slide"]')).toBeVisible()
    await expect(speaker.locator('iframe[title="Next Slide"]')).toBeVisible()

    await speaker.getByRole('button', { name: '2' }).click()
    await waitForRevealIndex(viewer, 'Live Presentation', '1:0:0')
    await expect(speaker.getByText('Speaker notes B')).toBeVisible({ timeout: 10000 })
  })

  test('speaker thumbnail navigation syncs vertical slides', async ({ context, request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        createLiveSlide('slide-a', 'Slide A', 'Horizontal notes', [
          createLiveSlide('slide-a-child', 'Slide A Child', 'Vertical notes'),
        ]),
        createLiveSlide('slide-b', 'Slide B', 'Slide B notes'),
      ],
    })
    const room = await createRoom(request)
    await openPresenter(context, presId, room.roomCode, room.presenterToken)

    const viewer = await context.newPage()
    await viewer.goto(`/live/${room.roomCode}`)
    await waitForRevealIndex(viewer, 'Live Presentation', '0:0:0')

    const speaker = await context.newPage()
    await speaker.goto(`/speaker/${room.roomCode}#cap=${room.speakerToken}`)
    await expect(speaker.getByRole('button', { name: '1.1' })).toBeVisible({ timeout: 10000 })
    await speaker.getByRole('button', { name: '1.1' }).click()

    await waitForRevealIndex(viewer, 'Live Presentation', '0:1:0')
    await expect(speaker.getByText('Vertical notes')).toBeVisible({ timeout: 10000 })
  })
})
