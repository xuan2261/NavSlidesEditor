# Phase 04: Tests — Export/Import Project

**Phase:** 04 | **Status:** ⏳ pending

---

## Context

- Phase 01: `phase-01-export-client.md`
- Phase 02: `phase-02-import-client.md`
- Phase 03: `phase-03-server-routes.md`

---

## Overview

**Priority:** 🟡 Trung bình
**Current status:** Test coverage mới cho export/import logic

---

## Test Strategy

### Unit Tests (Vitest)

Test 2 modules mới:
- `client/src/utils/media-detector.js` (Vitest)
- `client/src/utils/import-project.js` (Vitest)

### E2E Tests (Playwright)

- Test export → verify download triggered
- Test import → verify presentation created

---

## Unit Test: media-detector.js

```js
// client/src/utils/media-detector.test.js
import { describe, it, expect } from 'vitest'
import { detectLocalMedia } from './media-detector'

describe('detectLocalMedia', () => {
  it('returns hasLocalMedia: false for presentation without media', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          elements: [
            { type: 'text', content: 'Hello' },
            { type: 'shape', fill: '#fff' },
          ],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(false)
    expect(result.mediaUrls).toEqual([])
  })

  it('detects /uploads/ image in element src', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          elements: [
            { type: 'image', src: '/uploads/abc123.png' },
          ],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(true)
    expect(result.mediaUrls).toContain('/uploads/abc123.png')
  })

  it('detects background image', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          background: { type: 'image', src: '/uploads/bg.jpg' },
          elements: [],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(true)
    expect(result.mediaUrls).toContain('/uploads/bg.jpg')
  })

  it('ignores external URLs', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          elements: [
            { type: 'image', src: 'https://example.com/image.png' },
          ],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(false)
  })

  it('deduplicates same URL across slides', () => {
    const pres = {
      title: 'Test',
      slides: [
        { elements: [{ type: 'image', src: '/uploads/same.png' }] },
        { elements: [{ type: 'image', src: '/uploads/same.png' }] },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.mediaUrls).toEqual(['/uploads/same.png'])
  })
})
```

---

## Unit Test: import-project.js

```js
// client/src/utils/import-project.test.js
import { describe, it, expect } from 'vitest'
import { validateProjectFile, rewriteMediaUrls } from './import-project'

describe('validateProjectFile', () => {
  it('validates correct JSON project', () => {
    const parsed = {
      presentation: {
        title: 'Test Presentation',
        slides: [{ id: 's1', elements: [] }],
      },
      manifest: { version: '1.0', exportedAt: new Date().toISOString() },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing presentation', () => {
    const result = validateProjectFile({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing presentation data')
  })

  it('rejects non-array slides', () => {
    const parsed = {
      presentation: { title: 'Test', slides: 'not-array' },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('slides'))).toBe(true)
  })

  it('warns on unknown version', () => {
    const parsed = {
      presentation: { title: 'Test', slides: [] },
      manifest: { version: '99.0' },
    }
    const result = validateProjectFile(parsed)
    expect(result.warnings.some(w => w.includes('99.0'))).toBe(true)
  })
})

describe('rewriteMediaUrls', () => {
  it('rewrites local URLs to uploaded server URLs', () => {
    const presentation = {
      slides: [
        {
          elements: [
            { type: 'image', src: '/uploads/old-abc.png' },
          ],
        },
      ],
    }
    const urlMap = { '/uploads/old-abc.png': '/uploads/new-xyz.png' }
    const result = rewriteMediaUrls(presentation, urlMap)
    expect(result.slides[0].elements[0].src).toBe('/uploads/new-xyz.png')
  })

  it('does not change external URLs', () => {
    const presentation = {
      slides: [
        {
          elements: [
            { type: 'image', src: 'https://example.com/image.png' },
          ],
        },
      ],
    }
    const urlMap = {}
    const result = rewriteMediaUrls(presentation, urlMap)
    expect(result.slides[0].elements[0].src).toBe('https://example.com/image.png')
  })
})
```

---

## E2E Test: Export

```js
// tests/e2e/export-project.spec.js
import { test, expect } from '@playwright/test'

test.describe('Project Export', () => {
  test('Export Project downloads .navslides.json file', async ({ page }) => {
    await page.goto('/')
    await page.click('text=New Presentation')
    await page.waitForURL(/\/editor\//)

    // Add a slide with text
    await page.click('[data-testid="toolbar-text"]')
    await page.locator('.ProseMirror').fill('Hello World')

    // Open File menu → Export Project
    await page.click('text=File')
    const downloadPromise = page.waitForEvent('download')
    await page.click('text=Export Project (.navslides)')
    const download = await downloadPromise

    const filename = download.suggestedFilename()
    expect(filename.endsWith('.navslides.json') || filename.endsWith('.navslides')).toBe(true)
  })
})
```

---

## E2E Test: Import

```js
// tests/e2e/import-project.spec.js
import { test, expect } from '@playwright/test'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

test.describe('Project Import', () => {
  test('Import .navslides.json creates new presentation', async ({ page, request }) => {
    // Create a presentation first to export
    const pres = await apiCreatePresentation(request, 'Export Test')
    await page.goto('/')
    await page.goto(`/editor/${pres.id}`)

    // Inject a project JSON into a mock File
    const projectJson = JSON.stringify({
      version: '1.0',
      title: 'Imported Presentation',
      exportedAt: new Date().toISOString(),
      hasLocalMedia: false,
      presentation: {
        title: 'Imported Presentation',
        slides: [
          { id: 's1', elements: [{ type: 'text', content: 'Imported text' }] },
        ],
      },
    })

    // Set up file chooser mock
    const { setFiles } = page.locator('body')
    await page.route('/api/presentations', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        // Verify import created with imported data
        expect(body.title).toBe('Imported Presentation')
        expect(body.slides).toHaveLength(1)
        return route.fulfill({ json: { id: 'imported-id', ...body } })
      }
      return route.continue()
    })

    // Trigger import (via keyboard shortcut or menu)
    await page.goto('/')
    // Simulate file drop via DataTransfer API
    await page.evaluate((json) => {
      const dt = new DataTransfer()
      const file = new File([json], 'test.navslides.json', { type: 'application/json' })
      dt.items.add(file)
      const dropZone = document.querySelector('[data-import-dropzone]') || document.body
      const dropEvent = new DragEvent('drop', { bubbles: true, dataTransfer: dt })
      dropZone.dispatchEvent(dropEvent)
    }, projectJson)
  })
})
```

---

## Implementation Steps

- [ ] **4.1** Tạo `client/src/utils/media-detector.test.js` — unit tests
- [ ] **4.2** Tạo `client/src/utils/import-project.test.js` — unit tests
- [ ] **4.3** Tạo `tests/e2e/export-project.spec.js` — E2E export test
- [ ] **4.4** Tạo `tests/e2e/import-project.spec.js` — E2E import test
- [ ] **4.5** Chạy `npm run test` — verify all pass
- [ ] **4.6** Chạy `npm run test:e2e` — verify E2E pass

---

## Success Criteria

1. All Vitest unit tests pass (media-detector + import-project)
2. All Playwright E2E tests pass
3. Round-trip test: export → close browser → import → verify data identical

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| File download E2E flaky | Medium | Low | Use `waitForEvent('download')` |
| Mock file upload complex | Medium | Medium | Test via API directly |
| Race condition in round-trip | Low | Low | Wait for autosave before export |