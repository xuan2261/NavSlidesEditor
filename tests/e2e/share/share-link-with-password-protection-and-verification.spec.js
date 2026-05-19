import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLinkWithPassword,
} from '../fixtures/test-fixtures.js'

test.describe('Share link with password protection requires password to view', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Share Password E2E')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('GET /share/:token returns password form when token is protected', async ({ request }) => {
    const { token } = await apiCreateShareLinkWithPassword(request, presId, 'hunter2')
    const res = await request.get(`/share/${token}`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('Password Required')
    expect(html).toContain('type="password"')
  })

  test('POST /share/:token/verify rejects wrong password with 401', async ({ request }) => {
    const { token } = await apiCreateShareLinkWithPassword(request, presId, 'correct-password')
    const res = await request.post(`/share/${token}/verify`, { data: { password: 'WRONG' } })
    expect(res.status()).toBe(401)
  })

  test('POST /share/:token/verify accepts correct password', async ({ request }) => {
    const { token } = await apiCreateShareLinkWithPassword(request, presId, 'correct-password')
    const res = await request.post(`/share/${token}/verify`, { data: { password: 'correct-password' } })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.verified).toBe(true)
  })

  test('GET /share/:token returns 404 for unknown token', async ({ request }) => {
    const res = await request.get('/share/nonexistent-token-xyz')
    expect(res.status()).toBe(404)
  })

  test('share API response includes isProtected flag and never plaintext password', async ({ request }) => {
    const result = await apiCreateShareLinkWithPassword(request, presId, 'secret-marker-foo')
    expect(result.data?.isProtected).toBe(true)
    expect(JSON.stringify(result)).not.toContain('secret-marker-foo')
  })
})
