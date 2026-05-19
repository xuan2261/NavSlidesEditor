import { test as base, expect } from '@playwright/test'

const API_BASE = '/api'
const ALLOWED_BASE_URL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/

export function getBaseUrl() {
  return process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:4173'
}

function assertLoopback() {
  const baseUrl = getBaseUrl()
  if (!ALLOWED_BASE_URL.test(baseUrl)) {
    throw new Error(
      `Refusing API write: PLAYWRIGHT_TEST_BASE_URL=${baseUrl} is not a loopback address (127.0.0.1 or localhost). ` +
        `E2E tests perform destructive ops (create/update/delete) and must never run against shared/prod.`
    )
  }
}

/**
 * Helper: create a presentation via API (bypasses UI).
 */
export async function apiCreatePresentation(request, title = 'E2E Test Presentation') {
  assertLoopback()
  const res = await request.post(`${API_BASE}/presentations`, {
    data: {
      title,
      theme: 'black',
      transition: 'slide',
    },
  })
  if (!res.ok()) {
    console.error('API Error:', res.status(), await res.text())
  }
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Helper: delete presentation permanently via API.
 */
export async function apiDeletePresentation(request, id) {
  assertLoopback()
  const softDelete = await request.delete(`${API_BASE}/presentations/${id}`)
  const hardDelete = await request.delete(`${API_BASE}/presentations/${id}/permanent`)
  const acceptable = new Set([200, 404])
  if (!acceptable.has(softDelete.status()) || !acceptable.has(hardDelete.status())) {
    throw new Error(
      `Cleanup failed for ${id}: soft=${softDelete.status()} hard=${hardDelete.status()}`
    )
  }
}

/**
 * Helper: get a presentation by ID.
 */
export async function apiGetPresentation(request, id) {
  const res = await request.get(`${API_BASE}/presentations/${id}`)
  if (!res.ok()) {
    throw new Error(`Failed to fetch presentation ${id}: ${res.status()} ${await res.text()}`)
  }
  return res.json()
}

/**
 * Helper: update a presentation.
 */
export async function apiUpdatePresentation(request, id, data) {
  assertLoopback()
  const res = await request.put(`${API_BASE}/presentations/${id}`, { data })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Helper: create a share link for a presentation.
 */
export async function apiCreateShareLink(request, id) {
  assertLoopback()
  const res = await request.post(`${API_BASE}/presentations/${id}/share`, {
    data: { name: 'E2E Test Link' },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Helper: create a share link with password (and optional expiresInDays).
 */
export async function apiCreateShareLinkWithPassword(request, id, password, opts = {}) {
  assertLoopback()
  const res = await request.post(`${API_BASE}/presentations/${id}/share`, {
    data: { name: opts.name || 'E2E Password Link', password, expiresInDays: opts.expiresInDays },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Helper: revoke a single share token via DELETE /api/shares/:token.
 */
export async function apiRevokeShareToken(request, token) {
  assertLoopback()
  const res = await request.delete(`${API_BASE.replace('/api', '/api')}/shares/${token}`)
  return res
}

/**
 * Helper: create a version snapshot.
 */
export async function apiCreateSnapshot(request, id, name = 'E2E Snapshot') {
  assertLoopback()
  const res = await request.post(`${API_BASE}/presentations/${id}/snapshot`, {
    data: { name },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Custom test fixture that auto-creates and cleans up a presentation.
 */
export const test = base.extend({
  testPresentation: async ({ request }, use) => {
    const pres = await apiCreatePresentation(request, 'Auto E2E Fixture')
    await use(pres)
    try {
      await apiDeletePresentation(request, pres.id)
    } catch {
      // Ignore cleanup errors
    }
  },
})

export { expect }
