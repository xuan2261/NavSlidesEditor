import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

const SAMPLE_SLIDES = [
  {
    id: 'slide-1',
    elements: [
      { id: 'text-1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h1>Slide One</h1>' },
    ],
    notes: 'note one',
    background: { type: 'color', color: '#1e1e2e' },
  },
  {
    id: 'slide-2',
    elements: [
      { id: 'text-2', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<p>Body text</p>' },
    ],
    notes: '',
    background: { type: 'color', color: '#0f172a' },
  },
]

test.describe('HTML export and present endpoints with content validation', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'HTML export E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SAMPLE_SLIDES })
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('export endpoint sets attachment headers and HTML mime', async ({ request }) => {
    const res = await request.get(`/api/presentations/${presId}/export`)
    expect(res.ok()).toBeTruthy()
    expect(res.headers()['content-type']).toContain('text/html')
    expect(res.headers()['content-disposition']).toContain('attachment')
    expect(res.headers()['content-disposition']).toContain('.html')
  })

  test('export HTML includes both slide sections', async ({ request }) => {
    const res = await request.get(`/api/presentations/${presId}/export`)
    const html = await res.text()
    expect(html).toContain('reveal')
    const sectionCount = (html.match(/<section/g) || []).length
    expect(sectionCount).toBeGreaterThanOrEqual(2)
  })

  test('export HTML contains seeded title content', async ({ request }) => {
    const res = await request.get(`/api/presentations/${presId}/export`)
    const html = await res.text()
    expect(html).toContain('Slide One')
    expect(html).toContain('Body text')
  })

  test('present endpoint serves reveal.js scaffold', async ({ request }) => {
    const res = await request.get(`/api/presentations/${presId}/present`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('Reveal')
    expect(html).toContain('<section')
  })

  test('present endpoint preview mode strips controls', async ({ request }) => {
    const res = await request.get(`/api/presentations/${presId}/present?preview=true`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toMatch(/\.controls.*display:\s*none/)
  })

  test('export rejects unknown id', async ({ request }) => {
    const res = await request.get('/api/presentations/does-not-exist/export')
    expect(res.status()).toBe(404)
  })

  test('present endpoint renders into browser without console errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/api/presentations/${presId}/present`, { timeout: 15000 })
    await page.waitForSelector('.reveal', { timeout: 10000 })
    await expect(page.locator('.reveal section').first()).toBeVisible()
    const critical = errors.filter((e) => !e.includes('Warning') && !e.includes('net::'))
    expect(critical).toHaveLength(0)
  })
})
