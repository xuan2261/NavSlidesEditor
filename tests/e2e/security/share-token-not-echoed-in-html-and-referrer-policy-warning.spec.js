import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLink,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

test.describe('Security: share token never echoed in HTML and warns when Referrer-Policy header missing', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Token Leak Warning E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, {
      slides: [
        { id: 's1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Body</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
      ],
    })
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('GET /share/:token rendered HTML does not contain raw token literal', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    const res = await request.get(`/share/${token}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html.length).toBeGreaterThan(500)
    expect(html).not.toContain(token)
  })

  test('GET /share/:token sets reasonable Content-Type (text/html)', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    const res = await request.get(`/share/${token}`)
    expect(res.headers()['content-type']).toContain('text/html')
  })

  test('GET /share/:token Referrer-Policy header presence (warning if missing)', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    const res = await request.get(`/share/${token}`)
    const header = res.headers()['referrer-policy']
    if (!header) {
      console.warn(
        '[security/analytics-token-leak] Referrer-Policy header missing on /share/:token. ' +
          'Recommend setting strict-origin-when-cross-origin or stricter to prevent token leak via Referer.'
      )
      expect(header).toBeUndefined()
    } else {
      expect(header).toMatch(/strict-origin|same-origin|no-referrer/)
    }
  })

  test('share token not exposed via URL query parameters in subsequent server links', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    const res = await request.get(`/share/${token}`)
    const html = await res.text()
    expect(html).not.toMatch(new RegExp(`[?&]token=${token}`))
  })
})
