import { test, expect } from './fixtures/test-fixtures.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
  getBaseUrl,
} from './fixtures/test-fixtures.js'

const slide = (id, text) => ({
  id,
  background: { type: 'color', color: '#1e1e2e' },
  notes: '',
  elements: [{
    id: `${id}-text`,
    type: 'text',
    x: 100,
    y: 100,
    width: 600,
    height: 80,
    zIndex: 1,
    content: `<h1>${text}</h1>`,
  }],
})

async function socketPage(context) {
  const page = await context.newPage()
  await page.goto(getBaseUrl(), { timeout: 15000 })
  await page.addScriptTag({ url: '/vendor/socket.io/socket.io.min.js' })
  await expect.poll(() => page.evaluate(() => typeof window.io)).toBe('function')
  return page
}

async function joinRoom(page, { roomCode, role, presentationId, presenterToken }) {
  return page.evaluate(({ roomCode, role, presentationId, presenterToken }) => {
    window.liveSocket?.disconnect()
    window.liveEvents = []
    window.liveSocket = window.io({ path: '/ws', reconnection: true, forceNew: true })

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`Timed out joining ${role}`)), 8000)
      const finish = (state) => {
        window.clearTimeout(timer)
        resolve(state)
      }

      window.liveSocket.on('connect', () => {
        window.liveSocket.emit('join-room', {
          roomId: roomCode,
          role,
          presentationId: role === 'presenter' ? presentationId : undefined,
          presenterToken: role === 'presenter' ? presenterToken : undefined,
        })
      })
      window.liveSocket.on('sync-state', (state) => {
        window.liveEvents.push({ type: 'sync-state', state })
        finish(state)
      })
      window.liveSocket.on('presentation-data', (data) => {
        window.liveEvents.push({ type: 'presentation-data', hasHtml: Boolean(data?.html) })
      })
      window.liveSocket.on('navigate', (state) => {
        window.liveEvents.push({ type: 'navigate', state })
      })
      window.liveSocket.on('join-error', (error) => reject(new Error(error?.message || 'join-error')))
      window.liveSocket.on('room-not-found', () => reject(new Error('room-not-found')))
    })
  }, { roomCode, role, presentationId, presenterToken })
}

async function latestSyncState(page) {
  return page.evaluate(() => {
    const events = window.liveEvents || []
    const event = [...events].reverse().find((item) => item.type === 'sync-state')
    return event?.state || null
  })
}

async function stateEventCounts(page, slideIndex) {
  return page.evaluate((targetSlideIndex) => {
    const events = window.liveEvents || []
    return {
      sync: events.filter((event) =>
        event.type === 'sync-state' && event.state?.slideIndex === targetSlideIndex
      ).length,
      navigate: events.filter((event) =>
        event.type === 'navigate' && event.state?.slideIndex === targetSlideIndex
      ).length,
    }
  }, slideIndex)
}

async function disconnectSocket(page) {
  await page.evaluate(() => window.liveSocket?.disconnect())
  await expect.poll(() => page.evaluate(() => window.liveSocket?.connected ?? false)).toBe(false)
}

test.describe('Critical live user journeys', () => {
  test('[journey:live-reconnect] [cap:live.reconnect] [cap:live.presenter-authz] viewer catches current slide after reconnect and cannot navigate room', async ({
    browser,
    request,
  }) => {
    const pres = await apiCreatePresentation(request, 'Critical Live Reconnect')
    const presenterContext = await browser.newContext()
    const viewerContext = await browser.newContext()
    const auditContext = await browser.newContext()
    let roomCode
    let presenterToken

    try {
      await apiUpdatePresentation(request, pres.id, {
        slides: [slide('live-slide-1', 'Live reconnect first'), slide('live-slide-2', 'Live reconnect second')],
      })
      const roomRes = await request.post('/api/live/room')
      expect(roomRes.ok()).toBeTruthy()
      ;({ roomCode, presenterToken } = await roomRes.json())

      const presenter = await socketPage(presenterContext)
      const viewer = await socketPage(viewerContext)
      const auditor = await socketPage(auditContext)

      await joinRoom(presenter, {
        roomCode,
        role: 'presenter',
        presentationId: pres.id,
        presenterToken,
      })
      await expect.poll(() => presenter.evaluate(() =>
        window.liveEvents?.some((event) => event.type === 'presentation-data' && event.hasHtml)
      )).toBe(true)

      await expect(await joinRoom(viewer, { roomCode, role: 'viewer' })).toMatchObject({ slideIndex: 0 })
      await expect.poll(() => viewer.evaluate(() =>
        window.liveEvents?.some((event) => event.type === 'presentation-data' && event.hasHtml)
      )).toBe(true)

      await disconnectSocket(viewer)
      await presenter.evaluate(() => {
        window.liveSocket.emit('navigate', { slideIndex: 1, verticalIndex: 0, fragmentIndex: 0 })
      })
      await expect(await joinRoom(auditor, { roomCode, role: 'viewer' })).toMatchObject({ slideIndex: 1 })

      await expect(await joinRoom(viewer, { roomCode, role: 'viewer' })).toMatchObject({ slideIndex: 1 })
      await expect.poll(() => viewer.evaluate(() =>
        window.liveEvents?.some((event) => event.type === 'presentation-data' && event.hasHtml)
      )).toBe(true)
      expect(await stateEventCounts(viewer, 1)).toEqual({ sync: 1, navigate: 0 })

      await viewer.evaluate(() => {
        window.liveSocket.emit('navigate', { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 })
      })
      await expect(await joinRoom(auditor, { roomCode, role: 'viewer' })).toMatchObject({ slideIndex: 1 })
      await expect(await latestSyncState(viewer)).toMatchObject({ slideIndex: 1 })

      const cleanup = await request.delete(`/api/live/room/${roomCode}`, {
        headers: { Authorization: `Bearer ${presenterToken}` },
      })
      expect(cleanup.status()).toBe(204)
      const roomCheck = await request.get(`/api/live/room/${roomCode}`)
      expect(await roomCheck.json()).toEqual({ exists: false })
      roomCode = null
    } finally {
      if (roomCode && presenterToken) {
        await request.delete(`/api/live/room/${roomCode}`, {
          headers: { Authorization: `Bearer ${presenterToken}` },
        }).catch(() => {})
      }
      await Promise.all([
        presenterContext.close(),
        viewerContext.close(),
        auditContext.close(),
        apiDeletePresentation(request, pres.id).catch(() => {}),
      ])
    }
  })
})
