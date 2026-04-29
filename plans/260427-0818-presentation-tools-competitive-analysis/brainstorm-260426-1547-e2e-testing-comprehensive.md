# E2E Testing Strategy — NavSlides Editor
**Date:** 2026-04-26 | **Author:** Brainstormer Agent
**Scope:** Tooling, POM patterns, element interaction testing, CI/CD integration, visual regression

---

## 1. Problem Statement

### 1.1 What's Already Good

| Artifact | Status |
|---|---|
| Playwright framework | ✅ Đúng hướng, mạnh hơn Cypress |
| POM pattern (EditorPage.js 537 LOC) | ✅ Class-based, tốt |
| 22 spec files + fixtures | ✅ Cover nhiều area |
| API seeding pattern (test-fixtures.js) | ✅ Chống flaky test |
| waitForAutoSave() barrier | ✅ Tốt cho sync state |
| page.route() error injection | ✅ Đã dùng tốt |
| expect.poll() thay waitFor | ✅ Đúng cách |

### 1.2 What's Missing

| Gap | Impact | Coverage hiện tại |
|---|---|---|
| Element-specific interactions (Table, Chart, Code, Image, LaTeX, Shape) | HIGH | ~0% |
| Properties panel controls (color, font, alignment) | HIGH | ~10% |
| data-testid trên property controls | MEDIUM | 0% |
| Copy/paste cross-slide | MEDIUM | Partial |
| Context menu + panel delete | MEDIUM | Partial |
| Undo/redo stress (10+ operations) | MEDIUM | ~2 operations |
| Rapid sequential insert (50+ elements) | LOW | 0% |
| Visual regression | LOW | Placeholder only |
| Keyboard-only canvas navigation | LOW | 0% |
| Animation timeline reorder | LOW | 0% |
| Zustand store direct inspection | LOW | 0% |
| Shard strategy khi test > 50 | LOW | Không cần yets |

### 1.3 Structural Problem

**EditorPage.js: 537 LOC với 40+ methods** — vi phạm KISS. Khi đến 700+ LOC → forced rewrite under pressure.

---

## 2. Tool Selection: Playwright vs Cypress vs Puppeteer

| Criteria | Playwright | Cypress | Puppeteer |
|---|---|---|---|
| Speed | ✅ 30-50% nhanh hơn Cypress | Trung bình | Chậm |
| Multi-browser | ✅ Chromium + Firefox + WebKit | Chromium only | Chromium only |
| Auto-wait | ✅ Mặc định | ✅ | ❌ Phải tự viết |
| Trace viewer | ✅ Built-in | ❌ | ❌ |
| API mocking | ✅ page.route() | ✅ | ✅ |
| CI integration | ✅ Tốt | ✅ | ✅ |

**Verdict: Playwright — đúng hướng rồi. Tiếp tục.**

**Lý do chọn Playwright:**
- Multi-browser (WebKit = Safari macOS) không cần thêm plugin
- Trace viewer on first retry → debug CI failure cực nhanh
- Parallel execution mạnh hơn Cypress
- Không cần iframe như Cypress subject iframe pattern

---

## 3. Page Object Model (POM) — Cải Tiến

### 3.1 Current State
Class-based POM đúng cách. Cần split khi quá lớn.

### 3.2 Recommended POM Split (Phase 1)

```
tests/e2e/pages/
  EditorPage.js              # Entry point, orchestrates helpers
  CanvasHelper.js            # Canvas interactions, element CRUD
  InsertMenuHelper.js        # Insert menu + element creation
  PropertiesPanelHelper.js   # Property panel interactions
  SlidePanelHelper.js        # Slide management in panel
```

**Rule:** Mỗi helper class owns 1 concern. Không cross-helper imports. EditorPage.js orchestrates.

### 3.3 Selector Strategy (Priority Order)

```
1. getByRole, getByLabel, getByText  (accessibility-first)
2. data-testid                           (stable, refactor-resistant)
3. CSS class                             (canvas dynamic elements)
4. XPath                                 (LAST resort)
```

### 3.4 data-testid Naming Convention

```javascript
// Properties panel
data-testid="prop-color-fill"
data-testid="prop-color-stroke"
data-testid="prop-font-family"
data-testid="prop-font-size"
data-testid="prop-align-left"
data-testid="prop-align-center"
data-testid="prop-align-right"
data-testid="prop-lock-toggle"
data-testid="prop-rotation-input"
data-testid="prop-shadow-x"
data-testid="prop-shadow-y"
data-testid="prop-shadow-blur"
data-testid="prop-width"
data-testid="prop-height"
data-testid="prop-x"
data-testid="prop-y"
data-testid="prop-zindex"

// Table-specific
data-testid="table-add-row"
data-testid="table-add-col"
data-testid="table-delete-row"
data-testid="table-delete-col"
data-testid="table-merge-cells"

// Chart-specific
data-testid="chart-type-select"
data-testid="chart-data-editor"

// Element-level
data-testid="element-delete-btn"
data-testid="element-duplicate-btn"
data-testid="element-lock-toggle"
data-testid="canvas-resize-handle-se"
data-testid="canvas-rotation-handle"
```

---

## 4. Coverage Strategy — Trophy Model

| Layer | Tỷ lệ | Cần test gì |
|---|---|---|
| Static (ESLint/tsc) | 0% effort | Không cần test, linter xử |
| Unit | ~30% | Pure functions: htmlGenerator, shapeUtils, markdown-import |
| Integration | ~50% | Component interactions, store slices, API routes |
| **E2E** | **~10%** | **Critical paths: create/edit/delete, export, share, live** |

**E2E Priority cho NavSlides:**
- **P0:** Create presentation → add/edit/delete element → export HTML/PPTX
- **P0:** Share/live presentation flow
- **P1:** Undo/redo, find/replace, slide reordering, element interactions
- **P2:** Settings, templates, theme changes
- **P3:** Edge cases (empty states) — dùng integration test thay vì E2E

---

## 5. Test Layer 1: Element Insertion (16 Types)

### 5.1 What's Covered
| Element | Covered by |
|---|---|
| Text | toolbar-elements.spec.js |
| Shape | toolbar-elements.spec.js |
| Table | toolbar-elements.spec.js |
| Chart | toolbar-elements.spec.js |
| Code block | toolbar-elements.spec.js |
| LaTeX | toolbar-elements.spec.js |
| Markdown | toolbar-elements.spec.js |
| Callout | toolbar-elements.spec.js |
| HTML Embed | toolbar-elements.spec.js |
| Image (URL) | coverage-gaps.spec.js |
| Video | coverage-gaps.spec.js |
| Audio (upload) | coverage-gaps.spec.js |
| QR Code | coverage-gaps.spec.js |
| Icon | coverage-gaps.spec.js |
| SVG | coverage-gaps.spec.js |
| Drawing Canvas | coverage-gaps.spec.js |
| Line/Arrow | toolbar-elements.spec.js |

### 5.2 Standard Insertion Pattern

```javascript
async function insertItem(page, label) {
  const previousCount = await page.locator('.element-wrapper').count()
  const menu = page.locator('.insert-dropdown')
  if (!(await menu.isVisible().catch(() => false))) {
    await page.click('button.insert-trigger:has-text("Insert")')
    await expect(menu).toBeVisible()
  }
  const item = page.locator('.insert-dropdown .insert-item').filter({ hasText: label }).first()
  await item.scrollIntoViewIfNeeded()
  await item.click()
  await expect(page.locator('.element-wrapper')).toHaveCount(previousCount + 1, { timeout: 10000 })
}
```

### 5.3 URL Input Elements (Image, Video)

```javascript
await getInsertItem(page, 'Video')
await page.locator('input[placeholder="https://..."]').fill('https://example.com/video.mp4')
await page.getByRole('button', { name: 'OK' }).click()
await expect(page.locator('.element-wrapper')).toHaveCount(expected)
```

### 5.4 File Upload Elements (SVG, Audio)

```javascript
const chooser = page.waitForEvent('filechooser')
await getInsertItem(page, 'Audio / Upload').click()
await chooser.setFiles({
  name: 'sample.mp3',
  mimeType: 'audio/mpeg',
  buffer: Buffer.from('fake audio bytes'),
})
await expect.poll(async () => {
  const saved = await apiGetPresentation(request, presId)
  return saved.slides[0].elements.some(el => el.type === 'audio')
}).toBe(true)
```

---

## 6. Test Layer 2: Element Properties (HIGH PRIORITY)

### 6.1 Recommended Test File Structure

```
tests/e2e/
  element/
    element-insertion.spec.js     # 16 element types: insert + count check
    element-properties.spec.js    # Property panel controls per element type
    element-interactions.spec.js  # Table, chart, code, image, LaTeX specifics
    element-lifecycle.spec.js      # Delete (3 methods), copy/paste (2 scenarios)
    element-edge-cases.spec.js    # Empty canvas, zero-dim, overlap, rapid insert
```

### 6.2 Shape Properties

```javascript
test('shape: fill color updates correctly', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'sh1', type: 'shape', shape: 'rect', x: 150, y: 150,
      width: 200, height: 120, fill: '#6366f1', stroke: 'none', strokeWidth: 0, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-color-fill"]').fill('#ef4444')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].fill).toBe('#ef4444')
})

test('shape: stroke color + width', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-color-stroke"]').fill('#ffffff')
  await page.locator('[data-testid="prop-stroke-width"]').fill('4')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0]).toMatchObject({ stroke: '#ffffff', strokeWidth: 4 })
})

test('shape: border radius (rounded corners)', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-border-radius"]').fill('20')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].borderRadius).toBe(20)
})

test('shape: shadow controls', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'sh1', type: 'shape', shape: 'rect', x: 100, y: 100, width: 200, height: 120,
      fill: '#6366f1', stroke: 'none', strokeWidth: 0, borderRadius: 0, zIndex: 1,
      shadowX: 0, shadowY: 0, shadowBlur: 0, shadowColor: '#000'
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-shadow-x"]').fill('6')
  await page.locator('[data-testid="prop-shadow-y"]').fill('8')
  await page.locator('[data-testid="prop-shadow-blur"]').fill('12')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0]).toMatchObject({ shadowX: 6, shadowY: 8, shadowBlur: 12 })
})
```

### 6.3 Text Properties

```javascript
test('text: font family selection', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 't1', type: 'text', content: '<p>Hello</p>',
      x: 80, y: 160, width: 600, height: 180, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  const fontSelect = page.locator('[data-testid="prop-font-family"]')
  await fontSelect.selectOption('Georgia')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].fontFamily).toBe('Georgia')
})

test('text: font size updates', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-font-size"]').fill('48')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].fontSize).toBe(48)
})

test('text: alignment controls', async ({ page, request }) => {
  await editor.selectElement(0)
  // Test each alignment button
  for (const [label, value] of [['Left', 'left'], ['Center', 'center'], ['Right', 'right']]) {
    await page.locator(`[data-testid="prop-align-${value}"]`).click()
    await editor.waitForAutoSave()
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].textAlign).toBe(value)
  }
})
```

### 6.4 Table Properties

```javascript
test('table: add row via properties panel', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 't1', type: 'table', data: [['A','B'],['C','D']],
      headerRow: true, cellPadding: 8, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  const prevRows = await page.locator('.element-wrapper tr').count()
  await page.locator('[data-testid="table-add-row"]').click()
  await expect(page.locator('.element-wrapper tr')).toHaveCount(prevRows + 1)
})

test('table: add column', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="table-add-col"]').click()
  // verify via API
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].data[0]).toHaveLength(3)
})

test('table: merge cells', async ({ page, request }) => {
  // Seed 2x2 table, select two adjacent cells, merge
  await page.locator('.element-wrapper table tr').nth(0).locator('td').nth(0).click()
  await page.keyboard.down('Shift')
  await page.locator('.element-wrapper table tr').nth(0).locator('td').nth(1).click()
  await page.keyboard.up('Shift')
  await page.locator('[data-testid="table-merge-cells"]').click()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].mergedCells).toHaveLength(1)
})
```

### 6.5 Chart Properties

```javascript
test('chart: change type via dropdown', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'c1', type: 'chart', chartType: 'bar',
      chartData: { labels: ['X','Y'], datasets: [{ data: [1, 2] }] }, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  await page.locator('[data-testid="chart-type-select"]').selectOption('pie')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].chartType).toBe('pie')
})
```

### 6.6 Code Block Properties

```javascript
test('code block: change language', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'cb1', type: 'code', language: 'javascript',
      content: 'const x = 1;', width: 600, height: 320, zIndex: 2
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-code-language"]').selectOption('python')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].language).toBe('python')
})
```

### 6.7 Image Properties

```javascript
test('image: update URL updates src', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'i1', type: 'image', src: 'https://a.com/1.png',
      width: 400, height: 300, zIndex: 2
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-image-url"]').fill('https://b.com/2.png')
  await page.locator('[data-testid="prop-image-url"]').press('Enter')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].src).toContain('b.com/2.png')
})

test('image: object-fit selection', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-image-objectfit"]').selectOption('cover')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].objectFit).toBe('cover')
})
```

### 6.8 LaTeX Error Handling

```javascript
test('latex: invalid syntax shows error state', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'l1', type: 'latex', content: '\\frac{1}{2}',
      width: 500, height: 380, zIndex: 2
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  await page.locator('[data-testid="latex-edit-btn"]').click()
  await page.locator('textarea').fill('\\frac{1') // missing closing brace
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('.latex-error, .element-error')).toBeVisible({ timeout: 5000 })
})
```

---

## 7. Test Layer 3: Element Lifecycle (Delete, Copy, Paste)

### 7.1 Deletion — 3 Paths

```javascript
test('element deletion: keyboard Delete key', async ({ page, request }) => {
  await editor.addTextNode()
  const prev = await editor.getElementCount()
  await editor.deleteSelectedElement()
  await expect.poll(() => editor.getElementCount()).toBe(prev - 1)
})

test('element deletion: context menu', async ({ page, request }) => {
  await editor.addShape('Rectangle')
  await page.locator('.element-wrapper').first().click({ button: 'right' })
  await page.locator('[data-testid="context-menu-delete"]').click()
  const prev = await editor.getElementCount()
  await expect.poll(() => editor.getElementCount()).toBe(prev - 1)
})

test('element deletion: properties panel button', async ({ page, request }) => {
  await editor.addTextNode()
  await editor.selectElement(0)
  await page.locator('[data-testid="element-delete-btn"]').click()
  await expect.poll(() => editor.getElementCount()).toBe(0)
})

test('locked element: Delete key does NOT delete', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-lock-toggle"]').click()
  const prev = await editor.getElementCount()
  await page.keyboard.press('Delete')
  await expect.poll(() => editor.getElementCount()).toBe(prev) // unchanged
})
```

### 7.2 Copy/Paste

```javascript
test('copy/paste element within same slide', async ({ page, request }) => {
  await editor.addShape('Rectangle')
  const prev = await editor.getElementCount()
  await editor.copyElement()
  await editor.pasteElement()
  await expect.poll(() => editor.getElementCount()).toBe(prev + 1)
})

test('copy/paste element to different slide', async ({ page, request }) => {
  await editor.addShape('Rectangle')
  await editor.copyElement()
  await editor.addSlide()
  await page.locator('.slide-item').nth(0).click()  // return to slide 1
  await editor.pasteElement()
  await page.locator('.slide-item').nth(1).click()  // go to slide 2
  await expect.poll(() => editor.getElementCount()).toBe(1)  // slide 2 is empty
})

test('copy/paste preserves element type + properties', async ({ page, request }) => {
  await editor.addCodeBlock()
  await editor.copyElement()
  await editor.pasteElement()
  const saved = await apiGetPresentation(request, presId)
  const types = saved.slides[0].elements.map(el => el.type)
  expect(types.filter(t => t === 'code')).toHaveLength(2)
})
```

### 7.3 Duplicate via Ctrl+D

```javascript
test('duplicate element: Ctrl+D works', async ({ page, request }) => {
  await editor.addShape('Rectangle')
  const prev = await editor.getElementCount()
  await page.keyboard.press('Control+d')
  await expect.poll(() => editor.getElementCount()).toBe(prev + 1)
})

test('locked element: Ctrl+D does NOT duplicate', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-lock-toggle"]').click()
  const prev = await editor.getElementCount()
  await page.keyboard.press('Control+d')
  await expect.poll(() => editor.getElementCount()).toBe(prev)
})
```

---

## 8. Test Layer 4: Canvas Interactions

### 8.1 Resize (SE Handle)

```javascript
test('resize: SE handle changes dimensions', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'a', type: 'shape', shape: 'rect', x: 120, y: 120,
      width: 120, height: 80, fill: '#6366f1', stroke: 'none', strokeWidth: 0,
      borderRadius: 0, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await page.getByTestId('slide-element-a').click()

  const handle = await page.getByTestId('canvas-resize-handle-se').boundingBox()
  await page.mouse.move(handle.x + handle.width/2, handle.y + handle.height/2)
  await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width/2 + 120, handle.y + handle.height/2 + 90, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await editor.waitForAutoSave()

  await expect.poll(async () => {
    const saved = await apiGetPresentation(request, presId)
    const el = saved.slides[0].elements.find(item => item.id === 'a')
    return el.width > 120 && el.height > 80
  }).toBe(true)
})

test('resize: Shift key locks aspect ratio', async ({ page, request }) => {
  // Verify aspect ratio preserved during drag
  const handle = await page.getByTestId('canvas-resize-handle-se').boundingBox()
  const initialWidth = 200, initialHeight = 150
  const aspectRatio = initialWidth / initialHeight
  await page.mouse.move(handle.x + handle.width/2, handle.y + handle.height/2)
  await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width/2 + 200, handle.y + handle.height/2 + 200, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  // Verify: |width/height - aspectRatio| < 0.1
})
```

### 8.2 Rotation Handle

```javascript
test('rotation: 15-degree snap with Shift', async ({ page, request }) => {
  const rotationHandle = await page.getByTestId('canvas-rotation-handle').boundingBox()
  await page.keyboard.down('Shift')
  await page.mouse.move(rotationHandle.x + 80, rotationHandle.y - 40, { steps: 6 })
  await page.mouse.down()
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect.poll(async () => {
    const saved = await apiGetPresentation(request, presId)
    const rotation = saved.slides[0].elements[0].rotation || 0
    return rotation % 15
  }).toBe(0)
})
```

### 8.3 Arrow Key Nudge

```javascript
test('element: arrow key nudge moves element', async ({ page, request }) => {
  await editor.selectElement(0)
  const before = await apiGetPresentation(request, presId)
  const xBefore = before.slides[0].elements[0].x
  await page.keyboard.press('ArrowRight')
  await editor.waitForAutoSave()
  const after = await apiGetPresentation(request, presId)
  expect(after.slides[0].elements[0].x).toBe(xBefore + 1)
})
```

---

## 9. Test Layer 5: Multi-Select & Group Operations

```javascript
async function selectElements(page, ids) {
  await page.keyboard.press('Escape')
  await expect.poll(() => selectedCanvasElementIds(page)).toEqual([])

  await page.getByTestId(`slide-element-${ids[0]}`).click({ force: true })
  for (const id of ids.slice(1)) {
    await page.keyboard.down('Shift')
    await page.getByTestId(`slide-element-${id}`).click({ force: true })
    await page.keyboard.up('Shift')
  }
  await expect(page.locator('.tour-step-toolbar')).toContainText('Align:', { timeout: 5000 })
}

async function selectedCanvasElementIds(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-element-id]'))
      .filter(el => el.style.outline && el.style.outline !== 'none')
      .map(el => el.getAttribute('data-element-id'))
      .sort()
  )
}

test('multi-select: align left moves all to same X', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [
      shape('a', 100, 100, 100, 80, 1),
      shape('b', 260, 180, 100, 80, 2),
    ], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await selectElements(page, ['a', 'b'])
  await page.locator('[data-testid="align-left-btn"]').click()
  await expect.poll(async () => {
    const saved = await apiGetPresentation(request, presId)
    return saved.slides[0].elements.filter(el => ['a','b'].includes(el.id)).map(el => el.x)
  }).toEqual([100, 100])
})

test('multi-select: group/ungroup cycle', async ({ page, request }) => {
  await selectElements(page, ['a', 'b', 'c'])
  await page.locator('[data-testid="group-btn"]').click()
  await expect.poll(async () => {
    const saved = await apiGetPresentation(request, presId)
    return new Set(saved.slides[0].elements.map(el => el.groupId).filter(Boolean)).size
  }).toBe(1)
  await page.locator('[data-testid="ungroup-btn"]').click()
  await expect.poll(async () => {
    const saved = await apiGetPresentation(request, presId)
    return saved.slides[0].elements.every(el => !el.groupId)
  }).toBe(true)
})
```

---

## 10. Test Layer 6: Undo/Redo Stress

```javascript
test('undo/redo: 10 operations state machine', async ({ page, request }) => {
  await editor.gotoPresentation(presId)
  const states = []
  const MAX = 10

  // Add 10 elements
  for (let i = 0; i < MAX; i++) {
    await editor.addTextNode()
    await editor.waitForAutoSave()
  }
  states.push(await editor.getElementCount())
  expect(states[0]).toBe(MAX)

  // Undo 10 times
  for (let i = 0; i < MAX; i++) {
    await editor.undo()
    await editor.waitForAutoSave()
    states.push(await editor.getElementCount())
  }
  expect(states[MAX]).toBe(0)

  // Redo 10 times
  for (let i = 0; i < MAX; i++) {
    await editor.redo()
    await editor.waitForAutoSave()
    states.push(await editor.getElementCount())
  }
  expect(states[2 * MAX]).toBe(MAX)

  // Verify monotonic: no random jumps
  for (let i = 1; i <= MAX; i++) {
    expect(states[i]).toBeLessThan(states[i - 1])
  }
  for (let i = MAX + 1; i < states.length; i++) {
    expect(states[i]).toBeGreaterThan(states[i - 1])
  }
})

test('undo at initial state: no crash', async ({ page, request }) => {
  await editor.gotoPresentation(presId)
  // Undo when nothing to undo — should not crash
  await editor.undo()
  await editor.undo()
  await editor.undo()
  expect(await editor.getElementCount()).toBe(0)
})
```

---

## 11. Test Layer 7: Rapid Sequential Operations

```javascript
test('rapid insert: 50 elements final count matches', async ({ page, request }) => {
  await editor.gotoPresentation(presId)
  const count = 50
  for (let i = 0; i < count; i++) {
    await editor.addTextNode().catch(() => {})
  }
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  const elementCount = saved.slides[0].elements.filter(el => el.type === 'text').length
  expect(elementCount).toBe(count)
  expect(await editor.getElementCount()).toBe(count)
})

test('rapid insert: insertion order preserved (z-index)', async ({ page, request }) => {
  for (let i = 0; i < 10; i++) await editor.addTextNode()
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  const zIndexes = saved.slides[0].elements.map(el => el.zIndex)
  expect(zIndexes).toEqual([...zIndexes].sort((a, b) => a - b))
})
```

---

## 12. Test Layer 8: Edge Cases

```javascript
test('empty canvas: insert first element works', async ({ page, request }) => {
  await editor.gotoPresentation(presId)
  expect(await editor.getElementCount()).toBe(0)
  await editor.addTextNode()
  expect(await editor.getElementCount()).toBe(1)
})

test('zero-dimension element: does not crash', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'z1', type: 'shape', shape: 'rect', x: 100, y: 100,
      width: 0, height: 0, fill: '#6366f1', stroke: 'none', strokeWidth: 0,
      borderRadius: 0, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await expect(page.locator('.slide-canvas')).toBeVisible()
})

test('overlapping elements: z-order preserved', async ({ page, request }) => {
  await editor.addShape('Rectangle')
  await editor.addShape('Circle')
  const saved = await apiGetPresentation(request, presId)
  const [el1, el2] = saved.slides[0].elements
  expect(el2.zIndex).toBeGreaterThan(el1.zIndex)
})

test('negative coordinates: element positions correctly', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'n1', type: 'shape', shape: 'rect', x: -50, y: -50,
      width: 100, height: 100, fill: '#6366f1', stroke: 'none', strokeWidth: 0,
      borderRadius: 0, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].x).toBe(-50)
})

test('NaN guard: non-numeric input rejected', async ({ page, request }) => {
  await editor.selectElement(0)
  await page.locator('[data-testid="prop-width"]').fill('abc')
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  // Should not update to NaN
  expect(Number.isNaN(saved.slides[0].elements[0].width)).toBe(false)
})
```

---

## 13. Test Layer 9: API Chaos (Error Injection)

```javascript
test('mid-insert API failure: error shown, no crash', async ({ page, request }) => {
  await page.route('**/api/presentations/**', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) })
      return
    }
    await route.continue()
  })
  const prevCount = await editor.getElementCount()
  await editor.addTextNode()
  // UI should show error, element count unchanged
  await expect.poll(() => editor.getElementCount()).toBe(prevCount)
})

test('retry flow: failure then success', async ({ page, request }) => {
  let failOnce = true
  await page.route('**/api/presentations/**', async (route) => {
    if (failOnce && route.request().method() === 'PUT') {
      failOnce = false
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'Transient error' }) })
      return
    }
    await route.continue()
  })
  await editor.addTextNode()
  // Second attempt should succeed
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements.length).toBeGreaterThan(0)
})
```

---

## 14. CI/CD Integration

### 14.1 playwright.config.js Improvements

```javascript
module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : 4,  // tăng từ 2 lên 4
  reporter: [
    ['html'],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx concurrently ...`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
})
```

### 14.2 GitHub Actions — Shard Strategy (khi test > 50)

```yaml
- name: Run E2E tests
  run: npx playwright test --shard=${{ matrix.shard }}/${{ matrix.total }}
  matrix:
    shard: [1, 2, 3, 4]
    total: [4]

- name: Merge Playwright Reports
  run: npx playwright merge-reports ./all-reports
```

### 14.3 Flaky Test Detection

```bash
# Chạy trước khi merge
npx playwright test --repeat-each=5 --grep="element"

# Baseline: nếu flaky rate > 2% → fix trước khi merge
```

---

## 15. Visual Regression Testing

**Built-in Playwright đủ cho NavSlides** (không cần Percy vì single product, single theme):

```javascript
test('homepage: visual regression baseline', async ({ page }) => {
  await page.goto('/')
  const screenshot = await page.screenshot()
  expect(screenshot.length).toBeGreaterThan(10_000)  // placeholder
})

// Khi test count > 80, thêm:
test('editor chrome: screenshot matches baseline', async ({ page, request }) => {
  const pres = await apiCreatePresentation(request, 'Visual Regression')
  await editor.gotoPresentation(presId)
  await page.locator('body').evaluate(el => {
    el.style.animation = 'none'  // disable animations
  })
  await expect(page).toHaveScreenshot('editor-canvas.png', {
    maxDiffPixels: 100,
    maxDiffPixelRatio: 0.01,
  })
  await apiDeletePresentation(request, presId)
})
```

**Update snapshots:** `npx playwright test --update-snapshots`

---

## 16. Unresolved Questions

1. **data-testid** — ai thêm vào component files (frontend dev hay test author)?
2. **Visual regression** — `toMatchSnapshot()` hay `toMatchDiffSnapshot()`?
3. **Merge order** — Phase 1 (POM split + data-testid) phải merged trước Phase 2?
4. **Stress test undo/redo 10+** — có YAGNI không?
5. **Zustand store inspection** — `window.__store.getState()` có accessible không?
6. **Color picker type** — `<input type="color">` hay custom `div[title]` picker?
7. **Table row/col buttons** — trong properties panel hay inline trong table?

---

## 17. Implementation Roadmap

### Phase 1: Structural Fix (1-2 tuần)
- [ ] Split EditorPage.js → 4 helper modules (CanvasHelper, InsertMenuHelper, PropertiesPanelHelper, SlidePanelHelper)
- [ ] Add data-testid to all property panel controls
- [ ] Verify all 22 existing spec files pass (zero behavior change)
- [ ] Update code-standards.md với data-testid convention

### Phase 2: P0 Coverage Gaps (2-3 tuần)
- [ ] element-insertion.spec.js (16 types — verify)
- [ ] element-properties.spec.js (Shape, Text, Image, Code)
- [ ] element-interactions.spec.js (Table add/remove rows, Chart type, LaTeX errors)
- [ ] element-lifecycle.spec.js (Delete 3 paths, Copy/paste cross-slide)
- [ ] element-edge-cases.spec.js (Empty canvas, zero-dim, NaN guard)

### Phase 3: Scale (Data-triggered)
- [ ] Visual regression — chỉ khi test count > 80
- [ ] 4 shards — chỉ khi CI time > 15 min
- [ ] Zustand store inspection helper — chỉ khi debug complexity tăng

---

## 18. Success Metrics

| Metric | Baseline (hiện tại) | Target (Phase 2 done) |
|---|---|---|
| Element interaction coverage | ~15% | 70%+ |
| Properties panel coverage | ~10% | 60%+ |
| Total test count | ~40 | ~70 |
| data-testid trên property panel | 0 | 100% |
| CSS-class selectors trong POM | ~90% | <30% (panel) |
| Flaky test rate | unknown | <2% |

---

**Sources:**
- Playwright docs: https://playwright.dev/
- Project E2E specs: tests/e2e/
- POM: tests/e2e/pages/EditorPage.js
- Config: playwright.config.js
