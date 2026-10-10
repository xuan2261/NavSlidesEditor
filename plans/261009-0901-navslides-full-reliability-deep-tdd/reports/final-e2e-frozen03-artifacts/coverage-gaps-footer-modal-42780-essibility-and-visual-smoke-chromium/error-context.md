# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: coverage-gaps-footer-modals-responsive.spec.js >> Coverage Gaps: Editor controls and UI contracts >> covers footer settings, feature modals, responsive layout, keyboard accessibility, and visual smoke
- Location: tests\e2e\coverage-gaps-footer-modals-responsive.spec.js:46:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator(':focus')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator(':focus') with timeout 5000ms
  - waiting for locator(':focus')

```

```yaml
- text: Tablet or desktop required
- paragraph: Full slide editing needs a wider workspace. Use a tablet, desktop, or larger browser window.
- button "Back to presentations"
- contentinfo:
  - text: Slide 1 / 1
  - button "Normal view" [pressed]
  - button "Slide Sorter"
  - button "Present"
  - button "Zoom out": −
  - slider "Zoom level": "10"
  - button "Zoom in": +
  - button "Fit to window": Fit
  - text: 10%
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { EditorPage } from './pages/editor-page.js'
  3  | import {
  4  |   apiCreatePresentation,
  5  |   apiDeletePresentation,
  6  |   apiUpdatePresentation,
  7  | } from './fixtures/test-fixtures.js'
  8  | 
  9  | function shape(id, x, y, width = 100, height = 80, zIndex = 1) {
  10 |   return {
  11 |     id,
  12 |     type: 'shape',
  13 |     shape: 'rect',
  14 |     x,
  15 |     y,
  16 |     width,
  17 |     height,
  18 |     zIndex,
  19 |     fill: '#6366f1',
  20 |   }
  21 | }
  22 | 
  23 | function seededSlide(elements = []) {
  24 |   return {
  25 |     id: 'slide-1',
  26 |     elements,
  27 |     notes: '',
  28 |     background: { type: 'color', color: '#1e1e2e' },
  29 |   }
  30 | }
  31 | 
  32 | test.describe('Coverage Gaps: Editor controls and UI contracts', () => {
  33 |   let editor
  34 |   let presId
  35 | 
  36 |   test.beforeEach(async ({ page, request }) => {
  37 |     const pres = await apiCreatePresentation(request, 'Coverage Gaps')
  38 |     presId = pres.id
  39 |     editor = new EditorPage(page)
  40 |   })
  41 | 
  42 |   test.afterEach(async ({ request }) => {
  43 |     await apiDeletePresentation(request, presId)
  44 |   })
  45 | 
  46 |   test('covers footer settings, feature modals, responsive layout, keyboard accessibility, and visual smoke', async ({
  47 |     page,
  48 |     request,
  49 |   }) => {
  50 |     await apiUpdatePresentation(request, presId, {
  51 |       showFooter: true,
  52 |       showPageNumbers: true,
  53 |       footerMode: 'sequence',
  54 |       sequenceSections: ['Intro', 'Results'],
  55 |       slides: [seededSlide([shape('a', 120, 120)])],
  56 |     })
  57 |     await editor.gotoPresentation(presId)
  58 | 
  59 |     await expect(page.getByText('Slide Footer')).toBeVisible()
  60 |     await expect(page.locator('.slide-canvas')).toContainText('Intro')
  61 |     await expect(page.locator('.slide-canvas')).toContainText('1 / 1')
  62 | 
  63 |     await editor.openFileMenuItem('Sync to Cloud')
  64 |     await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toBeVisible()
  65 |     await page.keyboard.press('Escape')
  66 |     await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toHaveCount(0)
  67 | 
  68 |     await editor.openFileMenuItem('Save to GitHub')
  69 |     await expect(page.getByText('Push to GitHub')).toBeVisible()
  70 |     await page.keyboard.press('Escape')
  71 | 
  72 |     await page.getByRole('tab', { name: 'View' }).click()
  73 |     await page.getByRole('button', { name: 'Custom CSS' }).click()
  74 |     await expect(page.getByText('Custom CSS')).toBeVisible()
  75 |     await page.keyboard.press('Escape')
  76 | 
  77 |     await editor.menubar.openAnalytics()
  78 |     await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  79 |     await page.keyboard.press('Escape')
  80 | 
  81 |     await page.setViewportSize({ width: 390, height: 844 })
  82 |     await expect(page.getByText('Tablet or desktop required')).toBeVisible()
  83 |     await page.keyboard.press('Tab')
> 84 |     await expect(page.locator(':focus')).toBeVisible()
     |                                          ^ Error: expect(locator).toBeVisible() failed
  85 | 
  86 |     const screenshot = await page.screenshot()
  87 |     expect(screenshot.length).toBeGreaterThan(10_000)
  88 | 
  89 |     const exportRes = await request.get(`/api/presentations/${presId}/present`)
  90 |     expect(exportRes.ok()).toBeTruthy()
  91 |     expect(await exportRes.text()).toContain('Results')
  92 |   })
  93 | })
  94 | 
```