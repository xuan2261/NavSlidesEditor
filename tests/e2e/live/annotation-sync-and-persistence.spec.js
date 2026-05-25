import { test, expect } from '@playwright/test'
import { io } from 'socket.io-client'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { waitWithLastSample } from '../helpers/playwright-tolerant-poll-wait-helpers-for-live-presentation-e2e.js'

const SLIDES = [
  { id: 'slide-1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Slide One</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
  { id: 'slide-2', elements: [{ id: 't2', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Slide Two</h2>' }], notes: '', background: { type: 'color', color: '#0f172a' } },
]

function serverBaseUrl() {
  return `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT || '3202'}`
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(serverBaseUrl(), {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    const timer = setTimeout(() => { socket.close(); reject(new Error('socket connect timeout')) }, 8000)
    socket.once('connect', () => { clearTimeout(timer); resolve(socket) })
    socket.once('connect_error', (err) => { clearTimeout(timer); socket.close(); reject(err) })
  })
}

async function joinAsPresenter(socket, roomCode, presenterToken, presentationId) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('presenter join timeout')), 8000)
    socket.once('presentation-data', () => { clearTimeout(t); resolve() })
    socket.once('join-error', (err) => { clearTimeout(t); reject(new Error(err.message || 'join-error')) })
    socket.emit('join-room', { roomId: roomCode, role: 'presenter', presentationId, presenterToken })
  })
}

test.describe('Annotation sync and persistence across presenter and viewer', () => {
  let presId, roomCode, presenterToken, presenterSocket

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Annotation Sync E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
    const roomRes = await request.post('/api/live/room')
    const room = await roomRes.json()
    roomCode = room.roomCode
    presenterToken = room.presenterToken
    presenterSocket = await connectSocket()
    await joinAsPresenter(presenterSocket, roomCode, presenterToken, presId)
  })

  test.afterEach(async ({ request }) => {
    try { presenterSocket?.disconnect() } catch {}
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('viewer receives annotation:add stroke from presenter within tolerant window', async ({ page }) => {
    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    const annotation = { id: 'ann-1', d: 'M10,10 L100,100', color: '#ff0000', strokeWidth: 3 }
    presenterSocket.emit('annotation:add', { slideIndex: 0, annotation })

    await waitWithLastSample(
      'viewer SVG path count >= 1',
      async () => (await page.locator('svg path').count()) >= 1
    )
    const dAttr = await page.locator('svg path').first().getAttribute('d')
    expect(dAttr).toBe(annotation.d)
  })

  test('annotation:clear removes all strokes for current slide', async ({ page }) => {
    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    presenterSocket.emit('annotation:add', { slideIndex: 0, annotation: { id: 'a1', d: 'M0,0 L50,50', color: '#00ff00' } })
    presenterSocket.emit('annotation:add', { slideIndex: 0, annotation: { id: 'a2', d: 'M50,50 L100,100', color: '#0000ff' } })
    await waitWithLastSample('two strokes rendered', async () => (await page.locator('svg path').count()) >= 2)

    presenterSocket.emit('annotation:clear', { slideIndex: 0 })
    await waitWithLastSample('all strokes cleared', async () => (await page.locator('svg path').count()) === 0)
  })

  test('rejoining viewer receives previous-slide annotations via annotations:sync', async ({ context }) => {
    presenterSocket.emit('annotation:add', { slideIndex: 0, annotation: { id: 'persist-1', d: 'M10,10 L200,200', color: '#ff00ff' } })
    presenterSocket.emit('annotation:add', { slideIndex: 0, annotation: { id: 'persist-2', d: 'M20,20 L150,150', color: '#ffff00' } })

    await new Promise((r) => setTimeout(r, 500))

    const viewer = await context.newPage()
    await viewer.goto(`/live/${roomCode}`)
    await expect(viewer.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    await waitWithLastSample(
      'rejoining viewer sees persisted strokes',
      async () => (await viewer.locator('svg path').count()) >= 2
    )
  })

  test('annotation:remove deletes only target stroke', async ({ page }) => {
    await page.goto(`/live/${roomCode}`)
    await expect(page.locator('iframe[title="Live Presentation"]')).toBeVisible({ timeout: 15000 })

    presenterSocket.emit('annotation:add', { slideIndex: 0, annotation: { id: 'keep', d: 'M0,0 L50,50' } })
    presenterSocket.emit('annotation:add', { slideIndex: 0, annotation: { id: 'remove-me', d: 'M99,99 L101,101' } })
    await waitWithLastSample('both strokes rendered', async () => (await page.locator('svg path').count()) === 2)

    presenterSocket.emit('annotation:remove', { slideIndex: 0, annotationId: 'remove-me' })
    await waitWithLastSample('one stroke remains', async () => (await page.locator('svg path').count()) === 1)
  })
})
