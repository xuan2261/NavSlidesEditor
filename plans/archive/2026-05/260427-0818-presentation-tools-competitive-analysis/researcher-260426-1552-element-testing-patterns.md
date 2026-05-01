# Research Report: Automated Testing Patterns for "Add Element" Workflows

**Author:** researcher
**Date:** 2026-04-26
**Project:** NavSlides Editor
**Sources:** `tests/e2e/`, `client/src/data/element-defaults.js`, `client/src/components/properties/*.jsx`

---

## 1. Element Insertion Testing

### Current State
`toolbar-elements.spec.js` covers: Code Block, LaTeX, Markdown, Chart, Callout, HTML Embed, Shape, Table, Line/Arrow. `coverage-gaps.spec.js` fills: Image (URL), Video, Audio, QR, Icon, Drawing, SVG.

### Missing: Video/Audio URL input flows
```js
// coverage-gaps.spec.js already uses this pattern for image/video URL input:
await getInsertItem(page, 'Video')
await page.locator('input[placeholder="https://..."]').fill('https://example.com/video.mp4')
await page.getByRole('button', { name: 'OK' }).click()
await expect(page.locator('.element-wrapper')).toHaveCount(expected)
```

### Missing: Audio/Video file upload
```js
const audioChooser = page.waitForEvent('filechooser')
await getInsertItem(page, 'Audio / Upload').click()
await audioChooser.setFiles({
  name: 'sample.mp3', mimeType: 'audio/mpeg',
  buffer: Buffer.from('fake audio bytes'),
})
await expect.poll(async () => {
  const saved = await apiGetPresentation(request, presId)
  return saved.slides[0].elements.some(el => el.type === 'audio')
}).toBe(true)
```

### Missing: Icon search + pick
```js
await getInsertItem(page, 'Icon').click()
await page.getByPlaceholder('Search icons...').fill('Star')
await page.locator('button[title="Star"]').first().click()
// verify icon element type persisted
```

**Trade-off:** Fake file bytes work for upload flow but not for playback/filter testing. File-upload tests are inherently brittle on CI — prefer URL-based inputs for negative/error cases.

---

## 2. Element Property Testing

### Current State
`properties-panel.spec.js` seeds a shape via API then tests position input and NaN guard. `coverage-gaps.spec.js` tests rotation, shadow, z-index via multi-input fill.

### Recommended pattern: seed all element types via API, verify property persistence
```js
const ELEMENT_DEFAULTS = {
  shape: { id: 's1', type: 'shape', shape: 'rect', x: 100, y: 100, width: 200, height: 120,
    fill: '#6366f1', stroke: 'none', strokeWidth: 0, borderRadius: 0, zIndex: 1 },
  text:  { id: 't1', type: 'text',  content: '<p>Test</p>', x: 80, y: 160, width: 600, height: 180, zIndex: 1 },
  image: { id: 'i1', type: 'image', src: 'https://picsum.photos/400/300', x: 130, y: 100,
    width: 400, height: 300, objectFit: 'contain', zIndex: 2 },
}

for (const [type, el] of Object.entries(ELEMENT_DEFAULTS)) {
  test(`properties panel: ${type} shows correct controls`, async ({ page, request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [{ id: 's1', elements: [el], notes: '', background: { type: 'color', color: '#1e1e2e' } }]
    })
    await editor.gotoPresentation(presId)
    await editor.selectElement(0)

    const panel = page.locator('.properties-panel')
    await expect(panel).toBeVisible()

    // Shape: fill/stroke inputs exist
    if (type === 'shape') {
      await expect(panel.locator('input[type="color"]').first()).toBeVisible()
      await expect(panel.locator('input[title*="stroke"]')).toBeVisible()
    }
    // Image: src, alt, objectFit
    if (type === 'image') {
      await expect(panel.locator('input[placeholder*="image"]')).toBeVisible()
      await expect(panel.locator('select[title*="objectFit"]')).toBeVisible()
    }
    // Text: font size, alignment
    if (type === 'text') {
      await expect(panel.locator('input[type="number"][title*="font"]')).toBeVisible()
    }
  })
}
```

**Trade-off:** Seeding via API avoids slow UI insertion but skips UI validation (insert dialog behavior). Use API seed for property tests, UI insertion for flow tests.

**Adoption risk:** Low. Pattern already established in `properties-panel.spec.js`.

---

## 3. Element-Specific Interactions

### Table: Add/Remove rows, columns, merge cells
```js
test('table: add row via properties panel', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 't1', type: 'table',
      data: [['A','B'],['C','D']],
      headerRow: true, cellPadding: 8,
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)

  const prevRows = await page.locator('.element-wrapper tr').count()
  await page.locator('button[title="Add row"]').click()
  await expect(page.locator('.element-wrapper tr')).toHaveCount(prevRows + 1)
})

test('table: merge cells', async ({ page, request }) => {
  // Seed 2x2 table, select two adjacent cells, merge
  await page.locator('.element-wrapper table tr').nth(0).locator('td').nth(0).click()
  await page.keyboard.down('Shift')
  await page.locator('.element-wrapper table tr').nth(0).locator('td').nth(1).click()
  await page.keyboard.up('Shift')
  await page.locator('button[title="Merge cells"]').click()
  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].mergedCells).toHaveLength(1)
})
```

### Chart: Change type, edit data
```js
test('chart: change type via dropdown', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'c1', type: 'chart', chartType: 'bar',
      chartData: { labels: ['X'], datasets: [{ data: [1] }] }
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)

  const typeSelect = page.locator('select[title*="chart type"]')
  await typeSelect.selectOption('pie')
  await editor.waitForAutoSave()

  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].chartType).toBe('pie')
})
```

### Code block: Language selection
```js
test('code block: change language', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'cb1', type: 'code', language: 'javascript',
      content: 'const x = 1;', width: 600, height: 320, zIndex: 2
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)

  const langSelect = page.locator('select[title*="language"]')
  await langSelect.selectOption('python')
  await editor.waitForAutoSave()

  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].language).toBe('python')
})
```

### Image: URL input + filters
```js
test('image: update URL updates src', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'i1', type: 'image', src: 'https://a.com/1.png',
      width: 400, height: 300, zIndex: 2
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)

  await page.locator('input[placeholder*="image"]').fill('https://b.com/2.png')
  await page.locator('input[placeholder*="image"]').press('Enter')
  await editor.waitForAutoSave()

  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].src).toContain('b.com/2.png')
})
```

### LaTeX: Error handling for invalid syntax
```js
test('latex: invalid syntax shows error state', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'l1', type: 'latex', content: '\\frac{1}{2}', width: 500, height: 380, zIndex: 2
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  // Open LaTeX editor, enter invalid input
  await editor.selectElement(0)
  await page.locator('button[title="Edit LaTeX"]').click()
  await page.locator('textarea').fill('\\frac{1')  // missing closing brace
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('.latex-error, .element-error')).toBeVisible({ timeout: 5000 })
})
```

### Shape: Fill/stroke color
```js
test('shape: update fill color', async ({ page, request }) => {
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'sh1', type: 'shape', shape: 'rect', x: 150, y: 150,
      width: 200, height: 120, fill: '#6366f1', stroke: 'none', strokeWidth: 0, zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  await editor.selectElement(0)

  await page.locator('.properties-panel input[type="color"]').first().fill('#ef4444')
  await editor.waitForAutoSave()

  const saved = await apiGetPresentation(request, presId)
  expect(saved.slides[0].elements[0].fill).toBe('#ef4444')
})
```

**Trade-off:** Element-specific interaction tests require deep knowledge of each properties panel component's CSS selectors. Selector fragility is the main risk. Mitigate by using `data-testid` attributes on all property controls.

---

## 4. Element Deletion Testing

### Current State: `EditorPage.deleteSelectedElement()` uses `keyboard.press('Delete')`.

### Recommended: Cover all three deletion methods
```js
test('element deletion: keyboard Delete key', async ({ page, request }) => {
  await editor.addTextNode()
  const prev = await editor.getElementCount()
  await editor.deleteSelectedElement() // keyboard Delete
  await expect.poll(() => editor.getElementCount()).toBe(prev - 1)
})

test('element deletion: context menu', async ({ page, request }) => {
  await editor.addShape('Rectangle')
  await page.locator('.element-wrapper').first().click({ button: 'right' })
  await page.locator('.context-menu-item, [role="menuitem"]').filter({ hasText: /Delete/i }).click()
  const prev = await editor.getElementCount()
  await expect.poll(() => editor.getElementCount()).toBe(prev - 1)
})

test('element deletion: properties panel button', async ({ page, request }) => {
  await editor.addTextNode()
  await editor.selectElement(0)
  await page.locator('.properties-panel button[title="Delete element"]').click()
  await expect.poll(() => editor.getElementCount()).toBe(0)
})
```

**Trade-off:** Context menu label text varies across browsers/locales. Use `data-testid="delete-element"` on the menu item.

---

## 5. Copy/Paste Element Testing

### Recommended
```js
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
  await page.locator('.slide-item').nth(0).click() // return to slide 1
  await editor.pasteElement()
  await page.locator('.slide-item').nth(1).click() // go to slide 2
  await expect.poll(() => editor.getElementCount()).toBe(1) // slide 2 is empty
})

test('copy/paste preserves element type', async ({ page, request }) => {
  await editor.addCodeBlock()
  await editor.copyElement()
  await editor.pasteElement()
  const saved = await apiGetPresentation(request, presId)
  const types = saved.slides[0].elements.map(el => el.type)
  expect(types.filter(t => t === 'code')).toHaveLength(2)
})
```

**Trade-off:** Paste across slides requires correct canvas focus. If the canvas loses focus, paste pastes into wrong slide. Verify active slide matches expected paste target.

---

## 6. Boundary / Edge Case Testing

```js
test('empty canvas: insert first element', async ({ page, request }) => {
  await editor.gotoPresentation(presId)
  expect(await editor.getElementCount()).toBe(0)
  await editor.addTextNode()
  expect(await editor.getElementCount()).toBe(1)
})

test('insert element with zero dimensions does not crash', async ({ page, request }) => {
  // Seed zero-dim element via API
  await apiUpdatePresentation(request, presId, {
    slides: [{ id: 's1', elements: [{
      id: 'z1', type: 'shape', shape: 'rect', x: 100, y: 100,
      width: 0, height: 0, fill: '#6366f1', zIndex: 1
    }], notes: '', background: { type: 'color', color: '#1e1e2e' }}]
  })
  await editor.gotoPresentation(presId)
  // Should render without crash
  await expect(page.locator('.slide-canvas')).toBeVisible()
})

test('overlapping elements: z-order preserved', async ({ page, request }) => {
  await editor.addShape('Rectangle')
  await editor.addShape('Circle')
  const saved = await apiGetPresentation(request, presId)
  const [el1, el2] = saved.slides[0].elements
  expect(el2.zIndex).toBeGreaterThan(el1.zIndex)
})
```

---

## 7. Rapid Sequential Operations

```js
test('rapid insert: 50 text elements final count matches', async ({ page, request }) => {
  await editor.gotoPresentation(presId)
  const count = 50

  // Rapidly insert without waiting for each to complete
  const insertPromises = Array.from({ length: count }, () =>
    editor.addTextNode().catch(() => {}) // catch individual failures
  )
  await Promise.all(insertPromises)
  await editor.waitForAutoSave()

  const saved = await apiGetPresentation(request, presId)
  const elementCount = saved.slides[0].elements.filter(el => el.type === 'text').length
  expect(elementCount).toBe(count)

  // Verify no elements lost
  const uiCount = await editor.getElementCount()
  expect(uiCount).toBe(count)
})

test('rapid insert: insertion order preserved', async ({ page, request }) => {
  // Insert 10 elements, verify order in elements array matches z-index sequence
  for (let i = 0; i < 10; i++) await editor.addTextNode()
  await editor.waitForAutoSave()
  const saved = await apiGetPresentation(request, presId)
  const zIndexes = saved.slides[0].elements.map(el => el.zIndex)
  expect(zIndexes).toEqual([...zIndexes].sort((a, b) => a - b))
})
```

**Trade-off:** Parallel insertion (`Promise.all`) races against UI rendering. Use sequential insertion with short delays if ordering matters. Performance baseline: 50 inserts should complete under 30s.

---

## Summary: Recommended Test File Structure

```
tests/e2e/
  element-insertion.spec.js     # All 16 element types: insert + count check
  element-properties.spec.js   # Property panel controls per element type
  element-interactions.spec.js # Table, chart, code, image, LaTeX, shape specifics
  element-lifecycle.spec.js     # Delete (3 methods), copy/paste (2 scenarios)
  element-edge-cases.spec.js   # Empty canvas, zero-dim, overlap, rapid insert
```

---

## Key Implementation Notes

| Concern | Mitigation |
|---------|-----------|
| Selector fragility in property panels | Add `data-testid` to all property controls |
| Slow element insertion on CI | Seed via API; UI insertion only for flow tests |
| Paste cross-slide focus issues | Explicitly click target slide before paste |
| Rapid insert flakiness | Use `expect.poll` with 5s timeout, not `waitForFunction` |
| LaTeX rendering errors | Mock KaTeX or accept 5s render timeout for error state check |

---

## Unresolved Questions

1. What is the `data-element-id` attribute format used by `coverage-gaps.spec.js`? Does it match all element wrappers or only canvas elements?
2. Are color picker controls `<input type="color">` or custom `div[title]` pickers? Selector differs significantly.
3. Does the table component expose row/column add buttons in the properties panel, or only via context menu inside the table itself?
4. What is the exact CSS class/role for the LaTeX error indicator element (`.latex-error` vs other)?
5. Is there a `data-testid` convention already in the codebase for property controls?
