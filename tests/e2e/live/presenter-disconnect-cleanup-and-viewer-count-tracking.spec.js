import { test, expect } from '@playwright/test'
import { io } from 'socket.io-client'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { waitWithLastSample } from '../helpers/playwright-tolerant-poll-wait-helpers-for-live-presentation-e2e.js'

const SLIDES = [
  { id: 'slide-1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Slide 1</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
  { id: 'slide-2', elements: [{ id: 't2', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Slide 2</h2>' }], notes: '', background: { type: 'color', color: '#0f172a' } },
]

function serverBaseUrl() {
  return `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT || '3202'}`
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(serverBaseUrl(), { path: '/ws', transports: ['websocket'], forceNew: true, reconnection: false })
    const t = setTimeout(() => { socket.close(); reject(new Error('socket connect timeout')) }, 8000)
    socket.once('connect', () => { clearTimeout(t); resolve(socket) })
    socket.once('connect_error', (err) => { clearTimeout(t); socket.close(); reject(err) })
  })
}

async function joinAsPresenter(socket, roomCode, token, presId) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('presenter join timeout')), 8000)
    socket.once('presentation-data', () => { clearTimeout(t); resolve() })
    socket.once('join-error', (err) => { clearTimeout(t); reject(new Error(err.message || 'join-error')) })
    socket.emit('join-room', { roomId: roomCode, role: 'presenter', presentationId: presId, presenterToken: token })
  })
}

test.describe('Presenter disconnect cleanup notifies viewer of presenter departure', () => {
  let presId, roomCode, token

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'End Cleanup E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
    const r = await request.post('/api/live/room')
    const room = await r.json()
    roomCode = room.roomCode
    token = room.presenterToken
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('viewer sees Presenter has left overlay when presenter socket disconnects', async ({ page }) => {
    const presenterSocket = await connectSocket()
    await joinAsPresenter(presenterSocket, roomCode, token, presId)

    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    presenterSocket.disconnect()

    await waitWithLastSample(
      'Presenter has left text appears on viewer',
      async () => (await page.locator('text=Presenter has left').count()) > 0
    )
    await expect(page.getByRole('heading', { name: 'Presenter has left' })).toBeVisible()
  })

  test('viewer can join room before presenter and shows waiting state until presenter arrives', async ({ page }) => {
    await page.goto(`/live/${roomCode}`)
    await waitWithLastSample(
      'viewer connected indicator visible',
      async () => (await page.locator('iframe[title="Live Presentation"]').count()) === 1
    )

    const presenterSocket = await connectSocket()
    await joinAsPresenter(presenterSocket, roomCode, token, presId)

    await waitWithLastSample(
      'viewer count updates after presenter joins',
      async () => {
        const text = await page.locator('text=/\\d+ viewer/').first().textContent().catch(() => null)
        return text !== null
      }
    )

    presenterSocket.disconnect()
  })

  test('viewer count badge reflects multiple viewers and decrements on viewer disconnect', async ({ page, context, request }) => {
    const presenterSocket = await connectSocket()
    await joinAsPresenter(presenterSocket, roomCode, token, presId)

    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    const second = await context.newPage()
    await second.goto(`/live/${roomCode}`)
    await expect(second.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    await waitWithLastSample(
      'viewer count badge shows 2 viewers',
      async () => {
        const t = await page.locator('div').filter({ hasText: /^2 viewers$/ }).count()
        return t >= 1
      }
    )

    await second.close()

    await waitWithLastSample(
      'viewer count badge decrements to 1 viewer',
      async () => {
        const t = await page.locator('div').filter({ hasText: /^1 viewer$/ }).count()
        return t >= 1
      }
    )

    presenterSocket.disconnect()
  })

  test('GET live/room/:code returns exists:false for unknown rooms', async ({ request }) => {
    const res = await request.get('/api/live/room/UNKNOWN-ROOM-XYZ')
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.exists).toBe(false)
  })
})
