import { test, expect } from '@playwright/test'
import { io } from 'socket.io-client'
import {
  apiCreatePresentation,
  apiCreateShareLink,
  apiDeletePresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

const TRUSTED_HTML = `
<div id="trusted-html-status">booting</div>
<script>
  window.__trustedEmbedRuns = (window.__trustedEmbedRuns || 0) + 1;
  const status = document.getElementById('trusted-html-status');
  if (status) status.textContent = 'trusted-executed';
</script>
`

function serverBaseUrl() {
  return `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT || '3202'}`
}

async function waitForTrustedIframe(iframeLocator) {
  await expect(iframeLocator).toBeVisible({ timeout: 15000 })
  const handle = await iframeLocator.elementHandle()
  expect(handle).toBeTruthy()
  const frame = await handle.contentFrame()
  expect(frame).toBeTruthy()

  await expect
    .poll(
      async () => {
        return frame.evaluate(
          () => document.getElementById('trusted-html-status')?.textContent || null
        )
      },
      { timeout: 15000 }
    )
    .toBe('trusted-executed')
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(serverBaseUrl(), {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('socket connect timeout'))
    }, 8000)

    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once('connect_error', (err) => {
      clearTimeout(timer)
      socket.close()
      reject(err)
    })
  })
}

function waitForSocketEvent(socket, eventName, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${eventName}`)), timeoutMs)
    socket.once(eventName, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

test.describe('Hardening regressions', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Hardening Regression')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('analytics stays on the operator boundary and redacts share capabilities', async ({
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [],
          notes: '',
          background: { type: 'color', color: '#111827' },
        },
      ],
    })

    const share = await apiCreateShareLink(request, presId)
    const shareView = await request.get(`/share/${share.token}`)
    expect(shareView.ok()).toBeTruthy()

    const operatorResponse = await request.get(`/api/analytics/${presId}`)
    expect(operatorResponse.ok()).toBeTruthy()
    expect(operatorResponse.headers()['cache-control']).toBe('no-store')
    const payload = await operatorResponse.json()
    expect(payload.totalViews).toBeGreaterThanOrEqual(1)
    expect(payload.byLinkLabels['E2E Test Link']).toBeGreaterThanOrEqual(1)
    expect(payload).not.toHaveProperty('byToken')
    expect(JSON.stringify(payload)).not.toContain(share.token)
  })

  test('presenter takeover is rejected without presenter token', async ({ request }) => {
    const roomRes = await request.post('/api/live/room')
    expect(roomRes.ok()).toBeTruthy()
    const room = await roomRes.json()

    const attacker = await connectSocket()
    try {
      attacker.emit('join-room', {
        roomId: room.roomCode,
        role: 'presenter',
        presentationId: presId,
      })

      const rejection = await waitForSocketEvent(attacker, 'join-error')
      expect(rejection).toMatchObject({
        roomId: room.roomCode,
        reason: 'invalid-presenter-token',
      })
    } finally {
      attacker.disconnect()
    }
  })

  test('trusted HTML embed script still runs in editor, present, share, and export outputs', async ({
    page,
    context,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'el-html-1',
              type: 'html',
              x: 120,
              y: 80,
              width: 720,
              height: 360,
              zIndex: 1,
              content: TRUSTED_HTML,
            },
          ],
          notes: '',
          background: { type: 'color', color: '#111827' },
        },
      ],
    })

    await page.goto(`/editor/${presId}`)
    await waitForTrustedIframe(page.locator('iframe[title="HTML embed"]').first())

    const presentPage = await context.newPage()
    await presentPage.goto(`/api/presentations/${presId}/present`)
    await waitForTrustedIframe(presentPage.locator('.reveal .slides iframe').first())
    await presentPage.close()

    const share = await apiCreateShareLink(request, presId)
    const sharePage = await context.newPage()
    await sharePage.goto(`/share/${share.token}`)
    await waitForTrustedIframe(sharePage.locator('.reveal .slides iframe').first())
    await sharePage.close()

    const exportRes = await request.get(`/api/presentations/${presId}/export`)
    expect(exportRes.ok()).toBeTruthy()
    const exportHtml = await exportRes.text()
    expect(exportHtml).toContain('trusted-html-status')
    expect(exportHtml).toContain('window.__trustedEmbedRuns')
  })
})
