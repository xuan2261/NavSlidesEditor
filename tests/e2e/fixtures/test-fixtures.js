import { test as base, expect } from '@playwright/test'

const API_BASE = process.env.PLAYWRIGHT_API_BASE_URL || '/api'
const ALLOWED_BASE_URL = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/
const TRANSIENT_STATUSES = new Set([502, 503, 504])

export function getBaseUrl() {
  return process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:4173'
}

function assertLoopback() {
  const baseUrl = getBaseUrl()
  const apiBaseUrl = API_BASE.startsWith('http') ? API_BASE : baseUrl
  if (!ALLOWED_BASE_URL.test(baseUrl) || !ALLOWED_BASE_URL.test(apiBaseUrl)) {
    throw new Error(
      `Refusing API write: PLAYWRIGHT_TEST_BASE_URL=${baseUrl}, API_BASE=${API_BASE} is not a loopback address. ` +
        `E2E tests perform destructive ops (create/update/delete) and must never run against shared/prod.`
    )
  }
}

function responseStatus(response) {
  return typeof response.status === 'function' ? response.status() : response.status
}

async function withApiRetry(action, attempts = 5) {
  let lastResponse
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResponse = await action()
    if (!TRANSIENT_STATUSES.has(responseStatus(lastResponse)) || attempt === attempts) {
      return lastResponse
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
  }
  return lastResponse
}

/**
 * Helper: create a presentation via API (bypasses UI).
 */
export async function apiCreatePresentation(request, title = 'E2E Test Presentation') {
  assertLoopback()
  const res = await withApiRetry(() => request.post(`${API_BASE}/presentations`, {
    data: {
      title,
      theme: 'black',
      transition: 'slide',
    },
  }))
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
  if (!id) return
  const softDelete = await withApiRetry(() => request.delete(`${API_BASE}/presentations/${id}`))
  const hardDelete = await withApiRetry(() =>
    request.delete(`${API_BASE}/presentations/${id}/permanent`)
  )
  const acceptable = new Set([200, 404])
  const softStatus = responseStatus(softDelete)
  const hardStatus = responseStatus(hardDelete)
  if (!acceptable.has(softStatus) || !acceptable.has(hardStatus)) {
    throw new Error(
      `Cleanup failed for ${id}: soft=${softStatus} hard=${hardStatus}`
    )
  }
}

/**
 * Helper: get a presentation by ID.
 */
export async function apiGetPresentation(request, id) {
  assertLoopback()
  const res = await withApiRetry(() => request.get(`${API_BASE}/presentations/${id}`))
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
  const res = await withApiRetry(() => request.put(`${API_BASE}/presentations/${id}`, { data }))
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Helper: create a share link for a presentation.
 */
export async function apiCreateShareLink(request, id) {
  assertLoopback()
  const res = await withApiRetry(() => request.post(`${API_BASE}/presentations/${id}/share`, {
    data: { name: 'E2E Test Link' },
  }))
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Helper: create a share link with password (and optional expiresInDays).
 */
export async function apiCreateShareLinkWithPassword(request, id, password, opts = {}) {
  assertLoopback()
  const res = await withApiRetry(() => request.post(`${API_BASE}/presentations/${id}/share`, {
    data: { name: opts.name || 'E2E Password Link', password, expiresInDays: opts.expiresInDays },
  }))
  expect(res.ok()).toBeTruthy()
  return res.json()
}

/**
 * Helper: revoke a single share token via DELETE /api/shares/:token.
 */
export async function apiRevokeShareToken(request, token) {
  assertLoopback()
  const res = await withApiRetry(() => request.delete(`${API_BASE}/shares/${token}`))
  return res
}

/**
 * Helper: create a version snapshot.
 */
export async function apiCreateSnapshot(request, id, name = 'E2E Snapshot') {
  assertLoopback()
  const res = await withApiRetry(() => request.post(`${API_BASE}/presentations/${id}/snapshot`, {
    data: { name },
  }))
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
    await apiDeletePresentation(request, pres.id)
  },
})

export { expect }
