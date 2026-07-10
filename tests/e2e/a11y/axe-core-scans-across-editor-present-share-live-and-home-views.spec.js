import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { scanA11y, newBlockingViolations } from '../pages/axe-a11y-scan-helper-with-stable-dom-wait.js'
import { waitForVisibleText } from '../pages/wait-helpers.js'

const SLIDES = [
  { id: 's1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h1>Slide A</h1>' }], notes: 'Notes A', background: { type: 'color', color: '#1e1e2e' } },
  { id: 's2', elements: [{ id: 't2', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h1>Slide B</h1>' }], notes: '', background: { type: 'color', color: '#0f172a' } },
]

const SHARED_DISABLE_RULES = [
  'color-contrast',
  'landmark-one-main',
  'region',
  'page-has-heading-one',
]

test('axe baseline rejects a new node even when its rule ID is already known', () => {
  const newTarget = ['#brand-new-unlabelled-control']
  const fresh = newBlockingViolations([{
    id: 'label',
    impact: 'serious',
    nodes: [{ target: newTarget, html: '<input id="brand-new-unlabelled-control">' }],
  }], 'editor')

  expect(fresh).toHaveLength(1)
  expect(fresh[0].nodes).toEqual([
    expect.objectContaining({ target: newTarget }),
  ])
})

async function dismissTour(page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('navSlidesTutorialSeen', 'true')
      window.localStorage.setItem('navSlidesProductTourSeen', 'true')
    } catch {}
  })
}

test.describe('axe core scans across editor present share live and home views with stable DOM wait', () => {
  let presId

  test.beforeEach(async ({ request, page }) => {
    await dismissTour(page)
    const pres = await apiCreatePresentation(request, 'Axe A11y E2E')
    presId = pres.id
    await apiUpdatePresentation(request, presId, { slides: SLIDES })
  })

  test.afterEach(async ({ request }) => {
    if (presId) try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('editor page emits no serious or critical axe violations beyond known baseline', async ({ page }) => {
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    const { blocking } = await scanA11y(page, 'editor', { disableRules: SHARED_DISABLE_RULES })
    const fresh = newBlockingViolations(blocking, 'editor')
    if (fresh.length) console.log('[axe editor NEW critical]', JSON.stringify(fresh.map((c) => c.id), null, 2))
    expect(fresh, `new editor critical violations: ${fresh.map((c) => c.id).join(',')}`).toHaveLength(0)
  })

  test('present preview page emits zero serious or critical axe violations', async ({ page }) => {
    await page.goto(`/api/presentations/${presId}/present?preview=true`)
    await page.waitForSelector('.reveal section', { timeout: 15000 })
    const { blocking } = await scanA11y(page, 'present', { disableRules: SHARED_DISABLE_RULES })
    const fresh = newBlockingViolations(blocking, 'present')
    if (fresh.length) console.log('[axe present NEW critical]', JSON.stringify(fresh.map((c) => c.id), null, 2))
    expect(fresh).toHaveLength(0)
  })

  test('share landing page emits zero serious or critical axe violations', async ({ page, request }) => {
    const { token } = await apiCreateShareLink(request, presId)
    await page.goto(`/share/${token}`)
    await page.waitForSelector('.reveal section', { timeout: 15000 })
    const { blocking } = await scanA11y(page, 'share', { disableRules: SHARED_DISABLE_RULES })
    const fresh = newBlockingViolations(blocking, 'share')
    if (fresh.length) console.log('[axe share NEW critical]', JSON.stringify(fresh.map((c) => c.id), null, 2))
    expect(fresh).toHaveLength(0)
  })

  test('live viewer initial state emits zero serious or critical axe violations', async ({ page, request }) => {
    const r = await request.post('/api/live/room')
    const room = await r.json()
    await page.goto(`/live/${room.roomCode}`)
    await waitForVisibleText(page, /waiting|presenter|room|live/i)
    const { blocking } = await scanA11y(page, 'live-viewer', { disableRules: SHARED_DISABLE_RULES })
    const fresh = newBlockingViolations(blocking, 'live-viewer')
    if (fresh.length) console.log('[axe live NEW critical]', JSON.stringify(fresh.map((c) => c.id), null, 2))
    expect(fresh).toHaveLength(0)
  })

  test('home dashboard emits no serious or critical axe violations beyond known baseline', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    const { blocking } = await scanA11y(page, 'home', { disableRules: SHARED_DISABLE_RULES })
    const fresh = newBlockingViolations(blocking, 'home')
    if (fresh.length) console.log('[axe home NEW critical]', JSON.stringify(fresh.map((c) => c.id), null, 2))
    expect(fresh).toHaveLength(0)
  })

  test('settings page emits zero serious or critical axe violations', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    const { blocking } = await scanA11y(page, 'settings', { disableRules: SHARED_DISABLE_RULES })
    const fresh = newBlockingViolations(blocking, 'settings')
    expect(fresh, `settings violations: ${fresh.map((v) => v.id).join(',')}`).toHaveLength(0)
  })

  test('share modal emits zero serious or critical axe violations', async ({ page }) => {
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await page.getByRole('button', { name: /^Share$/i }).click()
    await page.getByRole('menuitem', { name: 'Share Link' }).click()
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    const { blocking } = await scanA11y(page, 'share-modal', {
      include: ['[role="dialog"]'],
      disableRules: SHARED_DISABLE_RULES,
    })
    const fresh = newBlockingViolations(blocking, 'share-modal')
    expect(fresh, `share modal violations: ${fresh.map((v) => v.id).join(',')}`).toHaveLength(0)
  })

  test('axe scan returns ruleset and full violations array shape', async ({ page }) => {
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    const { results, label } = await scanA11y(page, 'shape-check', { disableRules: SHARED_DISABLE_RULES })
    expect(label).toBe('shape-check')
    expect(Array.isArray(results.violations)).toBe(true)
    expect(Array.isArray(results.passes)).toBe(true)
    expect(typeof results.url).toBe('string')
  })
})
