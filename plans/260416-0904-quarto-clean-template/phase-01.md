# Phase 01: Browser Testing — Slide Menu Tools (Playwright)

## Overview

- **Priority:** High
- **Status:** pending
- **Type:** Test only — no code changes

## Context

`shared/src/presenterTools.js:95–102` defines 6 click handlers inside the `menu.custom[0].content` block:

```js
// presenterTools.js lines 95–102
'<li class="slide-menu-item" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()"><span class="km">f</span>Fullscreen</li>' +
'<li class="slide-menu-item" onclick="window.open(location.href.split(\'?\')[0]+\'?receiver\',\'_blank\')"><span class="km">s</span>Speaker View</li>' +
'<li class="slide-menu-item" onclick="Reveal.toggleOverview()"><span class="km">o</span>Slide Overview</li>' +
'<li class="slide-menu-item" onclick="window.open(location.href.split(\'?\')[0]+\'?print-pdf\',\'_blank\')"><span class="km">e</span>PDF Export Mode</li>' +
'<li class="slide-menu-item" onclick="Reveal.configure({view:\'scroll\'})"><span class="km">r</span>Scroll View Mode</li>' +
'<li class="slide-menu-item" onclick="Reveal.toggleHelp()"><span class="km">?</span>Keyboard Help</li>'
```

Goal: verify each handler fires correctly in a real presentation. Match Quarto demo behavior.

## Handler Verification Table

| # | Key | Label | Expected Behavior | Verification Method |
|---|-----|-------|------------------|---------------------|
| 1 | f | Fullscreen | `document.documentElement.requestFullscreen()` called | Browser fullscreen API triggered |
| 2 | s | Speaker View | New tab opened at `url/?receiver` | New window/tab opened |
| 3 | o | Slide Overview | `Reveal.toggleOverview()` fires | Grid overview shown |
| 4 | e | PDF Export | New tab at `url/?print-pdf` | Print-ready PDF page shown |
| 5 | r | Scroll View | `Reveal.configure({view:'scroll'})` | Continuous scroll layout |
| 6 | ? | Keyboard Help | `Reveal.toggleHelp()` fires | Overlay help dialog shown |

## Playwright Test Setup

### 1. Install Playwright (one-time)

```bash
cd D:\NCKH_2025\revealjs_gui
npx playwright install chromium --with-deps
```

### 2. Create test file

`tests/e2e/slide-menu-tools.spec.js`

```js
// tests/e2e/slide-menu-tools.spec.js
const { test, expect } = require('@playwright/test')

test.describe('Slide Menu Tools handlers', () => {
  test.beforeEach(async ({ page }) => {
    // Start a fresh presentation (blank slate)
    await page.goto('http://localhost:5173')
    await page.click('[data-testid="new-presentation"]')
    await page.waitForSelector('.reveal')
  })

  test('f — Fullscreen: requestFullscreen called', async ({ page }) => {
    // Trigger the menu item directly via evaluate
    const called = await page.evaluate(() => {
      let triggered = false
      const orig = document.documentElement.requestFullscreen
      document.documentElement.requestFullscreen = () => { triggered = true }
      // Simulate click
      document.querySelector('.slide-menu-item').click()
      return triggered
    })
    expect(called).toBe(true)
  })

  test('s — Speaker View: opens ?receiver tab', async ({ page }) => {
    const popupPromise = page.waitForEvent('popup')
    await page.evaluate(() => {
      const items = document.querySelectorAll('.slide-menu-item')
      items[1].click() // second item = s
    })
    const popup = await popupPromise
    expect(popup.url()).toContain('?receiver')
  })

  test('o — Slide Overview: toggleOverview fires', async ({ page }) => {
    const overviewActive = await page.evaluate(async () => {
      Reveal.toggleOverview()
      await new Promise(r => setTimeout(r, 300))
      return document.querySelector('.reveal-overview')
    })
    expect(overviewActive).not.toBeNull()
  })

  test('e — PDF Export: opens ?print-pdf tab', async ({ page }) => {
    const popupPromise = page.waitForEvent('popup')
    await page.evaluate(() => {
      const items = document.querySelectorAll('.slide-menu-item')
      items[3].click() // 4th item = e
    })
    const popup = await popupPromise
    expect(popup.url()).toContain('?print-pdf')
  })

  test('r — Scroll View: scroll layout applied', async ({ page }) => {
    await page.evaluate(() => {
      const items = document.querySelectorAll('.slide-menu-item')
      items[4].click() // 5th item = r
    })
    const view = await page.evaluate(() => Reveal.getConfig().view)
    expect(view).toBe('scroll')
  })

  test('? — Keyboard Help: toggleHelp fires', async ({ page }) => {
    await page.evaluate(() => {
      const items = document.querySelectorAll('.slide-menu-item')
      items[5].click() // 6th item = ?
    })
    const helpVisible = await page.locator('.reveal-help').isVisible()
    expect(helpVisible).toBe(true)
  })
})
```

### 3. Run tests

```bash
cd D:\NCKH_2025\revealjs_gui
npm run dev &
npx playwright test tests/e2e/slide-menu-tools.spec.js --reporter=list
```

### 4. Alternative: Manual click test if Playwright setup too complex

```bash
# Start dev server
npm run dev

# Open browser: http://localhost:5173
# Create any presentation
# Present (F or Play button)
# Open Slide Menu (hamburger or 'm' key)
# Click each item and verify behavior
# Document with screenshots
```

## Success Criteria

- All 6 handlers fire without JS errors in browser console
- No 404 resources loaded during handler execution
- Fullscreen, Speaker View, Overview, PDF, Scroll, Help all behave as documented

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Dev server not running | Run `npm run dev` first, wait for port 5173 |
| Slide Menu not rendered | Ensure `presenterTools.slideMenu: true` in test presentation config |
| Electron mode — different URL | Run tests on localhost:5173 (Vite), not Electron |