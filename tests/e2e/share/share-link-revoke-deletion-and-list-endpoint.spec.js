import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLink,
  apiCreateShareLinkWithPassword,
  apiRevokeShareToken,
} from '../fixtures/test-fixtures.js'

test.describe('Share link revoke and expiry behavior', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Share Revoke E2E')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('share token can be revoked via DELETE /api/shares/:token then returns 404', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)

    const list = await request.get(`/api/presentations/${presId}/shares`)
    const listBody = await list.json()
    expect(listBody.shares.some((s) => s.token === token)).toBe(true)

    const del = await apiRevokeShareToken(request, token)
    expect(del.ok()).toBeTruthy()
    const delBody = await del.json()
    expect(delBody.deleted).toBe(true)

    const after = await request.get(`/share/${token}`)
    expect(after.status()).toBe(404)
  })

  test('DELETE /api/shares/:token for unknown token returns 404', async ({ request }) => {
    const res = await request.delete('/api/shares/does-not-exist-token-xyz')
    expect(res.status()).toBe(404)
  })

  test('DELETE /api/presentations/:id/share revokes all shares for that presentation', async ({ request }) => {
    const { token: t1 } = await apiCreateShareLink(request, presId)
    const { token: t2 } = await apiCreateShareLink(request, presId)

    const res = await request.delete(`/api/presentations/${presId}/share`)
    expect(res.ok()).toBeTruthy()

    const after1 = await request.get(`/share/${t1}`)
    const after2 = await request.get(`/share/${t2}`)
    expect(after1.status()).toBe(404)
    expect(after2.status()).toBe(404)
  })

  test('GET /api/presentations/:id/shares lists active links and isProtected flag without password hash', async ({ request }) => {
    await apiCreateShareLink(request, presId)
    await apiCreateShareLinkWithPassword(request, presId, 'leak-marker-abc')

    const res = await request.get(`/api/presentations/${presId}/shares`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.shares)).toBe(true)
    expect(body.shares.length).toBe(2)
    const protectedShare = body.shares.find((s) => s.isProtected)
    expect(protectedShare).toBeTruthy()
    expect(JSON.stringify(body)).not.toContain('leak-marker-abc')
    expect(JSON.stringify(body)).not.toMatch(/\$2[ayb]\$/)
  })
})
