import { test as base, expect } from '@playwright/test'

const API_BASE = 'http://localhost:5173/api'

/**
 * Retry wrapper for API calls that may fail due to concurrent JSON file access.
 */
async function withRetry(fn, retries = 3, delay = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise((r) => setTimeout(r, delay * (i + 1)))
    }
  }
}

/**
 * Helper: create a presentation via API (bypasses UI).
 */
export async function apiCreatePresentation(request, title = 'E2E Test Presentation') {
  return withRetry(async () => {
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
  })
}

/**
 * Helper: delete presentation permanently via API.
 */
export async function apiDeletePresentation(request, id) {
  try {
    await request.delete(`${API_BASE}/presentations/${id}`)
    await request.delete(`${API_BASE}/presentations/${id}/permanent`)
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Helper: get a presentation by ID.
 */
export async function apiGetPresentation(request, id) {
  const res = await request.get(`${API_BASE}/presentations/${id}`)
  return res.json()
}

/**
 * Helper: update a presentation.
 */
export async function apiUpdatePresentation(request, id, data) {
  return withRetry(async () => {
    const res = await request.put(`${API_BASE}/presentations/${id}`, { data })
    expect(res.ok()).toBeTruthy()
    return res.json()
  })
}

/**
 * Helper: create a share link for a presentation.
 */
export async function apiCreateShareLink(request, id) {
  return withRetry(async () => {
    const res = await request.post(`${API_BASE}/presentations/${id}/share`, {
      data: { name: 'E2E Test Link' },
    })
    expect(res.ok()).toBeTruthy()
    return res.json()
  })
}

/**
 * Helper: create a version snapshot.
 */
export async function apiCreateSnapshot(request, id, name = 'E2E Snapshot') {
  return withRetry(async () => {
    const res = await request.post(`${API_BASE}/presentations/${id}/snapshot`, {
      data: { name },
    })
    expect(res.ok()).toBeTruthy()
    return res.json()
  })
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
