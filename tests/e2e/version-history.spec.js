import { test, expect } from '@playwright/test'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

const API_BASE = 'http://localhost:5173/api'

test.describe('Version History (Snapshots)', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Version History Test')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presId)
  })

  test('can create a snapshot via API', async ({ request }) => {
    const res = await request.post(`${API_BASE}/presentations/${presId}/snapshot`, {
      data: { name: 'My First Snapshot' },
    })
    expect(res.ok()).toBeTruthy()
    const snapshot = await res.json()
    expect(snapshot.id).toBeTruthy()
    expect(snapshot.name).toBe('My First Snapshot')
  })

  test('can list snapshots for a presentation', async ({ request }) => {
    await request.post(`${API_BASE}/presentations/${presId}/snapshot`, {
      data: { name: 'Snapshot A' },
    })
    await request.post(`${API_BASE}/presentations/${presId}/snapshot`, {
      data: { name: 'Snapshot B' },
    })

    const res = await request.get(`${API_BASE}/presentations/${presId}/snapshots`)
    const snapshots = await res.json()
    expect(snapshots.length).toBe(2)
  })

  test('can restore a snapshot', async ({ request }) => {
    const snapRes = await request.post(`${API_BASE}/presentations/${presId}/snapshot`, {
      data: { name: 'Before Changes' },
    })
    const snapshot = await snapRes.json()

    // Modify the presentation
    await request.put(`${API_BASE}/presentations/${presId}`, {
      data: { title: 'Modified Title' },
    })

    // Restore
    const restoreRes = await request.post(
      `${API_BASE}/presentations/${presId}/restore/${snapshot.id}`
    )
    expect(restoreRes.ok()).toBeTruthy()
    const restored = await restoreRes.json()
    expect(restored.title).toBe('Version History Test')
  })

  test('can delete a snapshot', async ({ request }) => {
    const snapRes = await request.post(`${API_BASE}/presentations/${presId}/snapshot`, {
      data: { name: 'To Delete' },
    })
    const snapshot = await snapRes.json()

    const deleteRes = await request.delete(
      `${API_BASE}/presentations/${presId}/snapshots/${snapshot.id}`
    )
    expect(deleteRes.ok()).toBeTruthy()

    const listRes = await request.get(`${API_BASE}/presentations/${presId}/snapshots`)
    const snapshots = await listRes.json()
    expect(snapshots.length).toBe(0)
  })
})
