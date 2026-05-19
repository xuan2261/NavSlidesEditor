import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLinkWithPassword,
  apiGetPresentation,
} from '../fixtures/test-fixtures.js'

const SECRET_MARKER = 'hunter2-secret-marker-do-not-leak'

test.describe('Security: share link plaintext password never leaks via API JSON responses', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Security Password Leak E2E')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('POST /api/presentations/:id/share response strips password field', async ({ request }) => {
    const result = await apiCreateShareLinkWithPassword(request, presId, SECRET_MARKER)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(SECRET_MARKER)
    expect(result.data?.password).toBeUndefined()
    expect(result.data?.isProtected).toBe(true)
  })

  test('GET /api/presentations/:id JSON does not echo plaintext password marker', async ({ request }) => {
    await apiCreateShareLinkWithPassword(request, presId, SECRET_MARKER)
    const data = await apiGetPresentation(request, presId)
    const serialized = JSON.stringify(data)
    expect(serialized).not.toContain(SECRET_MARKER)
  })

  test('GET /api/presentations/:id/shares list never includes password field nor bcrypt hash', async ({ request }) => {
    await apiCreateShareLinkWithPassword(request, presId, SECRET_MARKER)
    const res = await request.get(`/api/presentations/${presId}/shares`)
    const body = await res.json()
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain(SECRET_MARKER)
    expect(serialized).not.toMatch(/\$2[ayb]\$/)
    expect(body.shares?.[0]?.password).toBeUndefined()
    expect(body.shares?.[0]?.isProtected).toBe(true)
  })

  test('share verification path does not echo input password in error response', async ({ request }) => {
    const { token } = await apiCreateShareLinkWithPassword(request, presId, SECRET_MARKER)
    const res = await request.post(`/share/${token}/verify`, { data: { password: 'wrong-attempt-marker-zzz' } })
    expect(res.status()).toBe(401)
    const body = await res.text()
    expect(body).not.toContain('wrong-attempt-marker-zzz')
    expect(body).not.toContain(SECRET_MARKER)
  })
})
