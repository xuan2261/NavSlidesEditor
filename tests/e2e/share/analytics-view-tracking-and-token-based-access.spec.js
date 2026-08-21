import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'

test.describe('Analytics view tracking and operator access', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Analytics E2E')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('GET /api/analytics/:id returns operator analytics without a share capability', async ({
    request,
  }) => {
    const res = await request.get(`/api/analytics/${presId}`)
    expect(res.ok()).toBeTruthy()
    expect(res.headers()['cache-control']).toBe('no-store')
  })

  test('share-token query parameters do not control operator analytics access', async ({
    request,
  }) => {
    await apiCreateShareLink(request, presId)
    const res = await request.get(`/api/analytics/${presId}?token=invalid-token-zzz`)
    expect(res.ok()).toBeTruthy()
  })

  test('GET /api/analytics/:id returns the redacted operator analytics shape', async ({
    request,
  }) => {
    await apiCreateShareLink(request, presId)
    const res = await request.get(`/api/analytics/${presId}`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('totalViews')
    expect(body).toHaveProperty('dailyViews')
    expect(body).toHaveProperty('byLinkLabels')
    expect(body).toHaveProperty('recentEvents')
    expect(body).not.toHaveProperty('byToken')
    expect(Array.isArray(body.dailyViews)).toBe(true)
    expect(Array.isArray(body.recentEvents)).toBe(true)
  })

  test('share view increments totalViews counter', async ({ request }) => {
    const { token } = await apiCreateShareLink(request, presId)

    const before = await request.get(`/api/analytics/${presId}`)
    const beforeBody = await before.json()
    const startCount = beforeBody.totalViews

    await request.get(`/share/${token}`)
    await request.get(`/share/${token}`)

    await expect
      .poll(
        async () => {
          const r = await request.get(`/api/analytics/${presId}`)
          const b = await r.json()
          return b.totalViews
        },
        { timeout: 5000, intervals: [200, 500, 1000] }
      )
      .toBeGreaterThanOrEqual(startCount + 2)
  })

  test('analytics totals match between redacted link-label aggregation and totalViews', async ({
    request,
  }) => {
    const { token } = await apiCreateShareLink(request, presId)
    await request.get(`/share/${token}`)
    await request.get(`/share/${token}`)
    await request.get(`/share/${token}`)

    await expect
      .poll(
        async () => {
          const r = await request.get(`/api/analytics/${presId}`)
          const b = await r.json()
          return b.totalViews
        },
        { timeout: 5000 }
      )
      .toBeGreaterThanOrEqual(3)

    const r = await request.get(`/api/analytics/${presId}`)
    const body = await r.json()
    const sumByLinkLabel = Object.values(body.byLinkLabels).reduce((a, n) => a + n, 0)
    expect(sumByLinkLabel).toBe(body.totalViews)
  })
})
