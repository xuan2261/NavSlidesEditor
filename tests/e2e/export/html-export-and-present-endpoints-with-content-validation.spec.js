import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { SAMPLE_SLIDES } from './html-export-and-present-fixture.js'


test.describe('HTML export and present endpoints with content validation', () => {
  let presId

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'HTML export E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, {
      slides: SAMPLE_SLIDES,
      presenterTools: { slideMenu: true, chalkboard: true },
    })
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
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

  test('present mode runs Reveal 6 navigation, fragments, overview, notes, and plugins', async ({
    page,
  }) => {
    await page.goto(`/api/presentations/${presId}/present`, { timeout: 15000 })
    await page.waitForFunction(() => window.Reveal?.isReady?.(), null, { timeout: 10000 })

    const runtime = await page.evaluate(() => {
      const deck = window.Reveal
      deck.slide(0, 0)
      const fragmentAdvanced = deck.nextFragment()
      const fragmentIndices = deck.getIndices()
      deck.slide(0, 1)
      const verticalText = deck.getCurrentSlide()?.textContent || ''
      const notes = deck.getCurrentSlide()?.querySelector('aside.notes')?.textContent || ''
      deck.toggleOverview(true)
      const overview = deck.isOverview()
      deck.toggleOverview(false)
      deck.configure({ view: null, autoSlide: 60000, controls: false })
      deck.toggleAutoSlide(true)
      const autoSliding = deck.isAutoSliding()
      deck.toggleAutoSlide(false)
      return {
        version: deck.VERSION,
        fragmentAdvanced,
        fragmentIndex: fragmentIndices.f,
        verticalIndices: deck.getIndices(),
        verticalText,
        notes,
        overview,
        plugins: Object.keys(deck.getPlugins()),
        autoSliding,
      }
    })

    expect(runtime.version).toBe('6.0.1')
    expect(runtime.fragmentAdvanced).toBe(true)
    expect(runtime.fragmentIndex).toBe(0)
    expect(runtime.verticalIndices).toMatchObject({ h: 0, v: 1 })
    expect(runtime.verticalText).toContain('Vertical Child')
    expect(runtime.notes).toContain('vertical note')
    expect(runtime.overview).toBe(true)
    expect(runtime.autoSliding).toBe(true)
    expect(runtime.plugins).toEqual(
      expect.arrayContaining([
        'notes',
        'highlight',
        'menu',
        'RevealChalkboard',
        'RevealCustomControls',
      ])
    )
  })

  test('scroll query activates the Reveal 6 scroll view', async ({ page }) => {
    await page.goto(`/api/presentations/${presId}/present?view=scroll`, { timeout: 15000 })
    await page.waitForFunction(() => window.Reveal?.isReady?.(), null, { timeout: 10000 })

    await expect.poll(() => page.evaluate(() => window.Reveal.isScrollView())).toBe(true)
    await expect.poll(() => page.evaluate(() => window.Reveal.VERSION)).toBe('6.0.1')
  })

  test('share mode initializes the same Reveal 6 runtime', async ({ page, request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    await page.goto(`/share/${token}`, { timeout: 15000 })
    await page.waitForFunction(() => window.Reveal?.isReady?.(), null, { timeout: 10000 })

    await expect.poll(() => page.evaluate(() => window.Reveal.VERSION)).toBe('6.0.1')
    await expect(page.locator('.reveal section').first()).toBeVisible()
  })

  test('legacy print-pdf query activates the Reveal 6 print view', async ({ page }) => {
    await page.goto(`/api/presentations/${presId}/present?print-pdf`, { timeout: 15000 })
    await page.waitForFunction(() => window.Reveal?.isReady?.(), null, { timeout: 10000 })

    await expect.poll(() => page.evaluate(() => window.Reveal.isPrintView())).toBe(true)
    await expect.poll(() => page.evaluate(() => window.Reveal.VERSION)).toBe('6.0.1')
  })
})
