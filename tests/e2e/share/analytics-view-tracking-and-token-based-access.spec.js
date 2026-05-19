import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'

test.describe('Analytics view tracking and access control via share token', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Analytics E2E')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('GET /api/analytics/:id without token returns 403 access denied', async ({ request }) => {
    const res = await request.get(`/api/analytics/${presId}`)
    expect(res.status()).toBe(403)
  })

  test('GET /api/analytics/:id with wrong token returns 403 access denied', async ({ request }) => {
    await apiCreateShareLink(request, presId)
    const res = await request.get(`/api/analytics/${presId}?token=invalid-token-zzz`)
    expect(res.status()).toBe(403)
  })

  test('GET /api/analytics/:id with valid token returns analytics shape', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    const res = await request.get(`/api/analytics/${presId}?token=${token}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('totalViews')
    expect(body).toHaveProperty('dailyViews')
    expect(body).toHaveProperty('byToken')
    expect(body).toHaveProperty('recentEvents')
    expect(Array.isArray(body.dailyViews)).toBe(true)
    expect(Array.isArray(body.recentEvents)).toBe(true)
  })

  test('share view increments totalViews counter', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)

    const before = await request.get(`/api/analytics/${presId}?token=${token}`)
    const beforeBody = await before.json()
    const startCount = beforeBody.totalViews

    await request.get(`/share/${token}`)
    await request.get(`/share/${token}`)

    await expect
      .poll(
        async () => {
          const r = await request.get(`/api/analytics/${presId}?token=${token}`)
          const b = await r.json()
          return b.totalViews
        },
        { timeout: 5000, intervals: [200, 500, 1000] }
      )
      .toBeGreaterThanOrEqual(startCount + 2)
  })

  test('analytics totals match between byToken aggregation and totalViews', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    await request.get(`/share/${token}`)
    await request.get(`/share/${token}`)
    await request.get(`/share/${token}`)

    await expect
      .poll(
        async () => {
          const r = await request.get(`/api/analytics/${presId}?token=${token}`)
          const b = await r.json()
          return b.totalViews
        },
        { timeout: 5000 }
      )
      .toBeGreaterThanOrEqual(3)

    const r = await request.get(`/api/analytics/${presId}?token=${token}`)
    const body = await r.json()
    const sumByToken = Object.values(body.byToken).reduce((a, n) => a + n, 0)
    expect(sumByToken).toBe(body.totalViews)
  })
})
