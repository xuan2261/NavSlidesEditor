# E2E Testing Patterns for Canvas-Based Presentation Editors

**Author:** researcher
**Date:** 2026-04-26
**Project:** NavSlides Editor (React + TipTap + Zustand + Playwright)
**Sources:** 6 E2E specs, EditorPage POM, Playwright API docs

---

## 1. Canvas Interaction (Drag-Drop, Resize, Rotate)

**Confirmed pattern from coverage-gaps.spec.js:209-267:**

```js
// Resize via SE handle
const handle = await page.getByTestId('resize-handle-se').boundingBox()
await page.mouse.move(handle.x + handle.width/2, handle.y + handle.height/2)
await page.keyboard.down('Shift')
await page.mouse.down()
await page.mouse.move(handle.x + dx, handle.y + dy, { steps: 8 })
await page.mouse.up()
await page.keyboard.up('Shift')

// Verify persisted dimensions
await expect.poll(async () => {
  const saved = await apiGetPresentation(request, presId)
  return saved.slides[0].elements.find(el => el.id === 'a')
}).toMatchObject({ width: expect.any(Number) })
```

**Rotation with snap (Shift enforces 15-deg snap):**
```js
const rotationHandle = await page.getByTestId('rotation-handle').boundingBox()
await page.keyboard.down('Shift')
await page.mouse.move(rotationHandle.x + w/2, rotationHandle.y + h/2)
await page.mouse.down()
await page.mouse.move(rotationHandle.x + 80, rotationHandle.y - 40, { steps: 6 })
await page.mouse.up()
await page.keyboard.up('Shift')
// Verify snap: rotation % 15 === 0
```

**Key patterns:**
- Use `data-element-id` or `data-testid` on canvas handles for reliable targeting
- Always `await page.keyboard.down('Shift')` before drag for aspect-lock/rotation-snap
- Use `{ steps: 6-10 }` on mouse.move for realistic drag speed
- Verify persistence via `expect.poll()` against REST API, not just DOM
- Use `boundingBox()` then offset math instead of hardcoded coordinates

**Common pitfalls:**
- Forgetting `keyboard.up('Shift')` leaks modifier state into next test
- Dragging too fast (steps=1) can miss collision detection
- DOM-based boundingBox stale between move steps — recalculate per step for long drags
- `dragTo(target)` works for simple drops but complex handle interactions need low-level mouse API

---

## 2. Rich Text Editor (TipTap/ProseMirror)

**Confirmed pattern from editor.spec.js:253-300 and toolbar-elements.spec.js:86-113:**

```js
// Enter text editing mode
await element.click({ force: true })
await element.dblclick({ force: true })
await page.waitForSelector('.ProseMirror', { timeout: 5000 })

// Type and format
await page.locator('.ProseMirror').click({ force: true })
await page.keyboard.type('Hello world')
await page.keyboard.press('Control+a')
await editor.clickMainToolbarButton('Bold (Ctrl+B)')

// Verify ProseMirror state via page.evaluate
const state = await page.evaluate(() => ({
  proseMirrorCount: document.querySelectorAll('.ProseMirror').length,
  proseMirrorFocused: !!document.querySelector('.ProseMirror-focused'),
  strongCount: document.querySelectorAll('.ProseMirror strong').length,
  html: document.querySelector('.ProseMirror')?.innerHTML || '',
  firstStyledSpan: (() => {
    const span = document.querySelector('.ProseMirror span[style]')
    return span ? { fontFamily: span.style.fontFamily, fontSize: span.style.fontSize } : null
  })(),
}))
expect(state.strongCount).toBeGreaterThan(0)
```

**Clipboard operations (Ctrl+C/V):**
```js
await editorPage.selectElement(0)
await page.keyboard.press('Control+c')
const afterPaste = await editorPage.getElementCount()
await page.keyboard.press('Control+v')
await editorPage.waitForElementCount(afterPaste + 1)
```

**Key patterns:**
- `dblclick({ force: true })` + `waitForSelector('.ProseMirror')` to enter text mode
- Inspect ProseMirror state via `page.evaluate()` — no direct ProseMirror API access from tests
- Toolbar formatting works — verify via DOM state (strong/span counts), not screenshot
- `Ctrl+a` for select-all inside ProseMirror context works reliably

**Common pitfalls:**
- `force: true` needed because canvas overlays intercept normal clicks
- ProseMirror may mount multiple instances (hidden ones) — filter by `.ProseMirror-focused`
- Toolbar buttons must be clicked while ProseMirror has focus — verify with `.ProseMirror-focused` selector
- Clipboard may be cross-origin blocked in Playwright; prefer programmatic state verification over paste result

---

## 3. Multi-Element Selection (Shift-Click, Ctrl+Click)

**Confirmed pattern from coverage-gaps.spec.js:54-81:**

```js
async function selectElements(page, ids) {
  await page.keyboard.press('Escape')
  await expect.poll(() => selectedCanvasElementIds(page)).toEqual([])

  await page.getByTestId(`slide-element-${ids[0]}`).click({ force: true })
  expected.push(ids[0])
  await expect.poll(() => selectedCanvasElementIds(page)).toEqual(expected.sort())

  for (const id of ids.slice(1)) {
    await page.keyboard.down('Shift')
    await page.getByTestId(`slide-element-${id}`).click({ force: true })
    await page.keyboard.up('Shift')
    expected.push(id)
    await expect.poll(() => selectedCanvasElementIds(page)).toEqual(expected.sort())
  }

  // Multi-select toolbar appears
  await expect(page.locator('.tour-step-toolbar')).toContainText('Align:', { timeout: 5000 })
}

// Read selection state from DOM
async function selectedCanvasElementIds(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-element-id]'))
      .filter(el => el.style.outline && el.style.outline !== 'none')
      .map(el => el.getAttribute('data-element-id'))
      .sort()
  )
}
```

**Ctrl+Click (toggle selection):**
```js
await page.keyboard.down('ControlOrMeta')
await slide.click({ modifiers: ['ControlOrMeta'] })
await page.keyboard.up('ControlOrMeta')
```

**Key patterns:**
- Escape to deselect all first — avoid accumulated selection state
- Use `expect.poll()` after each click to verify selection state converges
- Selection state read from DOM attributes (`data-element-id`, `style.outline`) — no store inspection needed
- Multi-select toolbar appears (e.g., "Align:") — useful assertion point
- `modifiers: ['Shift' | 'Control' | 'ControlOrMeta']` on locator.click() is equivalent to keyboard.down + click + up

**Common pitfalls:**
- Modifier key ordering: down → click → up, never release between clicks for multi-select
- `ControlOrMeta` resolves per OS — use it instead of hardcoding Control
- Shift-click order matters (click then Shift-click appends; pre-Shift then click replaces)
- If canvas re-renders between clicks, element references stale — use `data-testid` stable handles

---

## 4. Real-Time State Management (Zustand + React UI)

**Confirmed pattern from editor.spec.js and properties-panel.spec.js:**

```js
// Pattern: verify Zustand state via API persistence + UI reactivity
await xInput.fill('200')
await xInput.press('Enter')
await editorPage.waitForAutoSave()

const saved = await apiGetPresentation(request, presId)
const element = saved.slides[0].elements.find(el => el.id === 'el-shape-1')
expect(element.x).toBe(200)

// Error simulation with page.route
await page.route(`**/api/presentations/${pres.id}/snapshot`, async route => {
  if (failSave) {
    await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Save failed' }) })
    return
  }
  await route.continue()
})
```

**API mocking for retry flows:**
```js
let failOnce = true
await page.route('**/api/**', async route => {
  if (failOnce && route.request().url().includes('snapshots')) {
    failOnce = false
    await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Network error' }) })
    return
  }
  await route.continue()
})
```

**Key patterns:**
- Zustand store is source of truth — verify via API persistence + `expect.poll()` for async convergence
- `waitForAutoSave()` (waits for "Saving..." badge to disappear) as the Zustand→API sync barrier
- `page.route()` for simulating API failures and testing retry/error UI flows
- `expect.poll()` instead of `waitFor()` for state convergence — polls until condition met or timeout
- Page errors collected via `page.on('pageerror', err => errors.push(err.message))`

**Common pitfalls:**
- Zustand mutations are synchronous but React re-renders are async — always await next render
- Auto-save debounce means immediate API calls aren't guaranteed — use `waitForAutoSave()` as barrier
- `page.route()` disables HTTP cache automatically — don't assume cache behavior in tests
- Service worker requests bypass `page.route()` — use `{ serviceWorkers: 'block' }` on context for full control

---

## 5. Undo/Redo Testing (State Machine)

**Confirmed pattern from undo-redo.spec.js:**

```js
test('can undo adding an element', async () => {
  const initialCount = await editorPage.getElementCount()
  await editorPage.addTextNode()
  const afterAdd = await editorPage.getElementCount()
  expect(afterAdd).toBeGreaterThan(initialCount)
  await editorPage.waitForAutoSave()

  await editorPage.deselectAll() // ensure undo targets correct operation
  await editorPage.undo()
  await expect.poll(async () => editorPage.getElementCount(), { timeout: 5000 })
    .toBe(initialCount)
})

test('can redo after undo', async () => {
  await editorPage.undo()
  await expect.poll(async () => editorPage.getElementCount(), { timeout: 5000 })
    .toBe(initialCount)
  await editorPage.redo()
  await expect.poll(async () => editorPage.getElementCount(), { timeout: 5000 })
    .toBe(afterAdd)
})
```

**State machine test matrix:**
```
State: [initial] → add element → [has element] → undo → [initial]
                                       ↓ redo
                                    [has element]
```

**Key patterns:**
- Use `expect.poll()` not fixed `waitFor()` — undo is async and may need multiple ticks
- Deselect all before undo to isolate the operation (avoid deselect being the undo target)
- `waitForAutoSave()` before undo — ensures history entry is persisted
- Verify both add/remove AND keyboard shortcuts (Ctrl+Z / Ctrl+Y) independently
- Chain: undo → redo → undo to verify state machine idempotency

**Common pitfalls:**
- History stack may be cleared by page reload — use fresh editor instance per test
- Undo across slide boundaries may behave differently — test per-slide and cross-slide
- Auto-save may itself trigger a history entry — account for this in state machine assertions

---

## 6. Animation and Transition Testing

**Confirmed pattern from animation-preview.spec.js:**

```js
test('animation preview opens in narrow viewport without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await editor.gotoPresentation(pres.id)

  await page.locator('button.menu-trigger').filter({ hasText: 'View' }).click()
  await page.locator('.dropdown-item').filter({ hasText: 'Animation Timeline' }).click()
  await expect(page.getByText('Animation Timeline')).toBeVisible()

  await page.getByRole('button', { name: /Preview/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Animation Preview' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close preview' })).toBeFocused()

  // No horizontal overflow
  const overflow = await page.evaluate(() => ({
    pageScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
  expect(overflow.pageScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1)

  // Dialog fully within viewport
  const metrics = await dialog.evaluate(node => {
    const rect = node.getBoundingClientRect()
    return { left: rect.left, right: rect.right, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, viewportWidth: window.innerWidth }
  })
  expect(metrics.left).toBeGreaterThanOrEqual(0)
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth)
})
```

**Key patterns:**
- Use `setViewportSize()` to test responsive constraints at breakpoints
- Check `getBoundingClientRect()` + viewport comparison for overflow detection
- Verify focus management (preview dialog should auto-focus close button)
- Escape closes dialog — test both keyboard and programmatic dismissal
- Measure scrollWidth vs clientWidth to detect horizontal overflow without scrolling

**Animation-specific:**
- Playwright has no built-in animation timing controls — use `page.waitForTimeout()` sparingly
- Prefer state-based assertions over time-based ones (verify end state, not mid-animation)
- CSS `transitionend` / `animationend` events not directly observable — use `expect.poll()` for final state
- For reveal.js iframe animations: poll `window.Reveal.getIndices()` until expected index reached

---

## 7. Modal/Panel Overlay Testing

**Confirmed patterns across multiple specs:**

```js
// Open modal via dropdown menu (editor.spec.js)
await editor.openFileMenuItem('Sync to Cloud')
await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toBeVisible()
await page.keyboard.press('Escape')
await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toHaveCount(0)

// Close via overlay backdrop click (editor.spec.js)
await editor.openSyncModal()
await editor.closeOverlayModal() // clicks .fixed.inset-0 at position { x: 10, y: 10 }
await expect(page.getByRole('dialog')).toHaveCount(0)

// Properties panel (properties-panel.spec.js)
await editorPage.selectElement(0)
await expect(page.locator('.properties-panel')).toBeVisible({ timeout: 5000 })
const inputs = panel.locator('input[type="number"]')
expect(await inputs.count()).toBeGreaterThanOrEqual(2)
```

**Key patterns:**
- Always test both Escape and backdrop click for dismissal paths
- Use `page.getByRole('dialog', { name: '...' })` for accessible dialog targeting
- Panel state (visible/hidden) tied to selection — deselect to verify panel clears
- Error recovery: dialog should stay open on error, not crash — use `page.on('pageerror')` and `expect(pageErrors).toEqual([])`
- Properties inputs: fill → Enter/blur → verify persistence via API

**Common pitfalls:**
- Backdrop click at (0,0) may hit wrong element — use position offset `{ x: 10, y: 10 }`
- `toHaveCount(0)` more reliable than `toBeHidden()` for dialogs (they may be detached from DOM)
- Portal-rendered modals: Playwright locators work across portals fine, no special handling needed
- Dialog close may trigger re-render that briefly shows panel — use `expect.poll()` for panel disappearance

---

## 8. SVG/Canvas Rendering Verification

**Confirmed pattern from coverage-gaps.spec.js and hardening-regression.spec.js:**

```js
// Iframe content readiness (reveal.js slide deck)
async function waitForRevealIndex(page, title, expected) {
  const iframe = page.locator(`iframe[title="${title}"]`)
  await expect(iframe).toBeVisible({ timeout: 15000 })
  const handle = await iframe.elementHandle()
  const frame = await handle.contentFrame()
  expect(frame).toBeTruthy()

  await expect.poll(async () => {
    return frame.evaluate(() => {
      const reveal = window.Reveal
      if (!reveal || !reveal.isReady?.()) return null
      const indices = reveal.getIndices()
      return `${indices.h}:${indices.v}:${indices.f}`
    })
  }, { timeout: 15000 }).toBe(expected)
}

// Element count as rendering proxy (toolbar-elements.spec.js)
const newCount = await editorPage.getElementCount()
expect(newCount).toBeGreaterThan(prevCount)

// SVG embed via file chooser
const chooser = page.waitForEvent('filechooser')
await getInsertItem(page, 'SVG').click()
await chooser.setFiles({
  name: 'diagram.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'),
})
```

**Key patterns:**
- Rendering verified via presence of `.element-wrapper` (not screenshot unless visual regression needed)
- reveal.js iframe: poll `window.Reveal.isReady()` before reading indices
- SVG/Canvas: use `page.evaluate()` to check computed dimensions or SVG element existence
- Media (image/video): verify type persisted in API response, not just DOM presence
- For visual regression: `page.screenshot()` with minimum byte count assertion

**Common pitfalls:**
- DOM presence doesn't mean rendering is correct — verify dimensions/attributes via API
- SVG in iframes requires `contentFrame()` + evaluate, not direct locator
- Lazy-loaded images may not be present immediately — `expect.poll()` or `waitForLoadState('networkidle')`
- Animations can cause intermittent element counts — always use `expect.poll()` for convergence

---

## Trade-off Matrix

| Area | Approach | Complexity | Flakiness | Coverage Depth |
|------|---------|-----------|-----------|----------------|
| Canvas drag/resize | Mouse API + boundingBox | Medium | Low | High |
| ProseMirror text | page.evaluate state inspection | Low | Low | High |
| Multi-select | Shift/Ctrl modifiers + poll | Low | Low | High |
| Zustand sync | API persistence + expect.poll | Low | Low | High |
| Undo/Redo | State machine + poll | Low | Medium | Medium |
| Animation | Viewport + boundingBox | Low | Low | Medium |
| Modals/Panels | getByRole + count assertions | Low | Low | High |
| SVG/Canvas | API + iframe evaluate | Medium | Low | High |

## Architectural Fit Assessment

- **POM (EditorPage.js)**: Excellent pattern already in use — isolates selector changes, provides reusable actions
- **API seeding**: Pre-populating slides via `apiUpdatePresentation()` is far more reliable than UI-only setup for canvas tests
- **Multi-context**: Live presentation tests use `context.newPage()` for presenter/viewer/remote — correct pattern
- **Socket.IO**: Direct `io()` client connection in tests for room event verification
- **Route interception**: `page.route()` used for error simulation — battle-tested in this codebase

## Gaps & Recommendations

1. **Drag-and-drop element reordering** (moving element from slide panel to canvas) not covered — needs mouse drag between panel and canvas
2. **Keyboard-only canvas navigation** (arrow keys for nudge, Tab through elements) not tested
3. **Fragment/animation timeline reordering** via drag in animation panel not tested
4. **Zustand store direct inspection** (`page.evaluate(() => window.__store.getState())`) not used — would enable faster state assertions without API round-trip
5. **Visual regression** (screenshot diff) not implemented — would catch CSS rendering regressions in canvas
6. **Continuous-history undo chain** (10+ operations) not stress-tested

---

**Sources:**
- [Playwright Locator API](https://playwright.dev/docs/api/class-locator)
- [Playwright Mouse API](https://playwright.dev/docs/api/class-mouse)
- [Playwright Page API](https://playwright.dev/docs/api/class-page)
- Project E2E specs: `tests/e2e/{editor,undo-redo,toolbar-elements,properties-panel,coverage-gaps,live,animation-preview,find-replace,keyboard-shortcuts}.spec.js`
- Project POM: `tests/e2e/pages/EditorPage.js`
