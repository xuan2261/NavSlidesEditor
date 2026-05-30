import { test, expect } from '@playwright/test'
import { io } from 'socket.io-client'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { waitWithLastSample } from '../helpers/playwright-tolerant-poll-wait-helpers-for-live-presentation-e2e.js'

const TIMER_ELEMENT_ID = 'timer-elem-1'

const SLIDES = [
  {
    id: 'slide-1',
    elements: [
      { id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Timer Slide</h2>' },
      { id: TIMER_ELEMENT_ID, type: 'text', x: 100, y: 200, width: 600, height: 80, content: '<p>Timer placeholder</p>' },
    ],
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  },
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

test.describe('Live timer broadcast via game-timer socket events to viewer', () => {
  let presId, roomCode, token, presenterSocket

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Timer Broadcast E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
    const r = await request.post('/api/live/room')
    const room = await r.json()
    roomCode = room.roomCode
    token = room.presenterToken
    presenterSocket = await connectSocket()
    await joinAsPresenter(presenterSocket, roomCode, token, presId)
  })

  test.afterEach(async ({ request }) => {
    try { presenterSocket?.disconnect() } catch {}
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('presenter game-timer-start propagates to viewer window.__timerStates', async ({ page }) => {
    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    presenterSocket.emit('game-timer-start', { elementId: TIMER_ELEMENT_ID, duration: 60 })

    const state = await waitWithLastSample(
      'viewer __timerStates has running timer',
      async () =>
        page.evaluate((id) => {
          const s = window.__timerStates?.[id]
          return s && s.running && s.duration === 60 ? s : null
        }, TIMER_ELEMENT_ID)
    )
    expect(state.running).toBe(true)
    expect(state.duration).toBe(60)
    expect(state.remaining).toBeGreaterThan(0)
  })

  test('game-timer-pause toggles running flag false on viewer', async ({ page }) => {
    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    presenterSocket.emit('game-timer-start', { elementId: TIMER_ELEMENT_ID, duration: 30 })
    await waitWithLastSample(
      'timer started on viewer',
      async () => page.evaluate((id) => window.__timerStates?.[id]?.running === true, TIMER_ELEMENT_ID)
    )

    presenterSocket.emit('game-timer-pause', { elementId: TIMER_ELEMENT_ID })
    await waitWithLastSample(
      'timer paused on viewer',
      async () => page.evaluate((id) => window.__timerStates?.[id]?.running === false, TIMER_ELEMENT_ID)
    )
  })

  test('game-timer-stop emits zero remaining and viewer clears running state', async ({ page }) => {
    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    presenterSocket.emit('game-timer-start', { elementId: TIMER_ELEMENT_ID, duration: 45 })
    await waitWithLastSample(
      'timer started',
      async () => page.evaluate((id) => window.__timerStates?.[id]?.running === true, TIMER_ELEMENT_ID)
    )

    presenterSocket.emit('game-timer-stop', { elementId: TIMER_ELEMENT_ID })
    await waitWithLastSample(
      'timer stopped on viewer',
      async () =>
        page.evaluate((id) => {
          const s = window.__timerStates?.[id]
          return s && s.running === false && s.remaining === 0
        }, TIMER_ELEMENT_ID)
    )
  })

  test('rejoining viewer receives existing running timer state via initial timer:sync', async ({ context }) => {
    // Wait for the server to echo timer:sync back to the presenter (the handler
    // stores timer state before broadcasting) so the late viewer is guaranteed to
    // get the running timer in its join-time timer:sync.
    let synced = false
    presenterSocket.on('timer:sync', () => { synced = true })
    presenterSocket.emit('game-timer-start', { elementId: TIMER_ELEMENT_ID, duration: 90 })
    await waitWithLastSample('presenter receives timer:sync echo', async () => synced)

    const lateViewer = await context.newPage()
    await lateViewer.goto(`/live/${roomCode}`)
    await expect(lateViewer.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    const state = await waitWithLastSample(
      'late viewer hydrated with running timer',
      async () =>
        lateViewer.evaluate((id) => {
          const s = window.__timerStates?.[id]
          return s && s.running === true ? s : null
        }, TIMER_ELEMENT_ID)
    )
    expect(state.running).toBe(true)
    expect(state.duration).toBe(90)
  })
})
