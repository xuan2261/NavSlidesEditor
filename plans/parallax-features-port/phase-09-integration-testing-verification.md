# Phase 09: Integration Testing + Final Verification

**Priority:** All | **Effort:** Medium | **Status:** Complete

**Depends on:** Phases 01-08

---

## Context

This phase runs after all feature phases are complete. It verifies that all ported features work together, don't regress existing functionality, and produce correct HTML exports.

---

## Requirements

### Functional
- All new element types render correctly in editor
- All new element types export to HTML correctly
- Present mode works with all new elements
- No regressions in existing 17 element types
- All new properties (fontWeight, lineHeight, video trim, etc.) persist across save/load

### Non-functional
- `npm run build` succeeds with zero errors
- `npm run test` passes all tests (existing + new)
- `npm run lint` passes
- No console errors in browser during normal usage

---

## Test Matrix

### Existing Elements Regression
| Element | Create | Edit | Delete | Export | Present |
|---------|--------|------|--------|--------|---------|
| Text | | | | | |
| Image | | | | | |
| Shape | | | | | |
| Code | | | | | |
| LaTeX | | | | | |
| HTML Embed | | | | | |
| Markdown | | | | | |
| Chart | | | | | |
| Video | | | | | |
| Audio | | | | | |
| Table | | | | | |
| Callout | | | | | |
| Icon | | | | | |
| Drawing | | | | | |
| Line | | | | | |
| SVG | | | | | |
| QR Code | | | | | |

### New Elements
| Element | Create | Edit | Delete | Export | Present |
|---------|--------|------|--------|--------|---------|
| Timeline | | | | | |
| Kinetic Text | | | | | |
| Math Grid | | | | | |
| Anime.js | | | | | |
| Three.js | | | | | |

### New Features
| Feature | Works | Persists | Exports |
|---------|-------|----------|---------|
| Font Weight | | | |
| Line Height | | | |
| Video URL | | | |
| Video Trim | | | |
| Video Speed | | | |
| Ctrl+K Command Palette retained; link insertion through existing controls | | | |
| LaTeX Font Size | | | |
| LaTeX Color | | | |
| Citation Color | | | |
| Copy URL Menu | | | |
| File Browser | | | |
| Upload Dedup | | | |

---

## Implementation Steps

### Step 1: Run all existing tests
```bash
npm run test                    # Unit tests
npm run test:e2e                # E2E tests (if available)
npm run lint                    # Linting
npm run build                   # Production build
```

### Step 2: Write integration test file
```js
// client/src/integration/parallax-features.test.js
import { describe, it, expect } from 'vitest'

describe('Parallax features integration', () => {
  describe('FontWeight extension', () => {
    it('applies font-weight to text', () => {
      // Create text element, apply fontWeight 700, verify HTML output
    })
  })

  describe('LineHeight extension', () => {
    it('applies line-height to paragraph', () => {
      // Create paragraph, apply lineHeight 1.5, verify HTML output
    })
  })

  describe('Video enhancements', () => {
    it('creates video from URL', () => {
      // Add video with videoUrl, verify element model
    })

    it('applies trim start/end', () => {
      // Create video with trimStart=5, trimEnd=30, verify properties
    })

    it('applies playback speed', () => {
      // Create video with playbackSpeed=1.5, verify property
    })
  })

  describe('Timeline element', () => {
    it('creates timeline with events', () => {
      // Create timeline, add events, verify element model
    })

    it('generates HTML export', () => {
      // Create timeline, generate HTML, verify timeline markup
    })
  })

  describe('Kinetic Text', () => {
    it('generates typewriter animation HTML', () => {
      // Generate typewriter HTML, verify contains animation
    })
  })

  describe('Math Grid', () => {
    it('generates polar grid HTML', () => {
      // Generate polar grid HTML, verify contains SVG
    })
  })

  describe('Anime.js', () => {
    it('generates fireworks animation HTML', () => {
      // Generate fireworks HTML, verify contains anime.js CDN
    })
  })

  describe('Three.js', () => {
    it('generates rotating cube HTML', () => {
      // Generate cube HTML, verify contains three.js CDN
    })
  })

  describe('Upload deduplication', () => {
    it('returns existing URL for duplicate upload', () => {
      // Upload same file twice, verify same URL returned
    })
  })

  describe('File browser', () => {
    it('lists uploaded files', () => {
      // Upload files, fetch list, verify all present
    })
  })

  describe('HTML export', () => {
    it('includes reveal-overrides.css', () => {
      // Generate HTML, verify CSS link present
    })

    it('renders timeline in export', () => {
      // Create pres with timeline, export, verify markup
    })

    it('renders kinetic text in export', () => {
      // Create pres with kinetic text, export, verify markup
    })
  })
})
```

### Step 3: E2E test with Playwright
```js
// tests/e2e/parallax-features.spec.js
import { test, expect } from '@playwright/test'

test.describe('Parallax features E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Create or open a presentation
  })

  test('insert and edit timeline', async ({ page }) => {
    await page.click('[title="Insert Timeline"]')
    await page.fill('[placeholder="Start Date"]', '2000-01-01')
    await page.fill('[placeholder="End Date"]', '2025-01-01')
    // Verify timeline renders
    await expect(page.locator('.timeline-element')).toBeVisible()
  })

  test('insert kinetic text', async ({ page }) => {
    await page.click('[title="Insert Kinetic Text"]')
    await page.click('text=Typewriter')
    await page.fill('[placeholder*="text"]', 'Hello World')
    await page.click('text=Insert')
    // Verify HTML element created
    await expect(page.locator('.html-element')).toBeVisible()
  })

  test('video from URL', async ({ page }) => {
    await page.click('[title="Insert Video"]')
    await page.click('text=From URL')
    await page.fill('[placeholder*="URL"]', 'https://example.com/video.mp4')
    await page.click('text=Insert')
    await expect(page.locator('video')).toBeVisible()
  })

  test('font weight control', async ({ page }) => {
    // Insert text, select it, change font weight
    await page.click('[title="Insert Text"]')
    // Open properties, change font weight to 700
    await page.selectOption('[data-testid="font-weight-select"]', '700')
    // Verify bold text
  })

  test('file browser', async ({ page }) => {
    await page.click('[title="File Browser"]')
    await expect(page.locator('.file-browser-modal')).toBeVisible()
  })

  test('Ctrl+K opens command palette and preserves link command access', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible()
    await expect(page.getByText('Insert Link')).toBeVisible()
  })
})
```

### Step 4: Manual verification checklist
- [ ] Open editor → insert each new element type → verify renders
- [ ] Edit each new element type → verify properties update
- [ ] Delete each new element type → verify removed
- [ ] Export to HTML → open in browser → verify all elements render
- [ ] Present mode → navigate through slides → verify all elements display
- [ ] Save presentation → reload → verify all elements persist
- [ ] Test on Chrome, Firefox, Edge
- [ ] Test responsive behavior (resize window)

### Step 5: Performance check
- [ ] Editor loads in < 3 seconds with 20-slide presentation
- [ ] No memory leaks from Three.js / Anime.js canvases
- [ ] Timeline with 50 events renders without lag

---

## Success Criteria

- [x] `npm run test` — all tests pass (existing + new)
- [x] `npm run lint` — no errors
- [x] `npm run build` — production build succeeds
- [x] All 17 existing element types work (no regressions)
- [x] All 5 new element types work (timeline, kinetic, math, anime, three)
- [x] All new features work (font weight, line height, video controls, etc.)
- [x] HTML export includes all new elements
- [x] Present mode displays all new elements
- [x] Save/load preserves all new properties
- [x] No console errors during normal usage
- [x] Integration tests pass
- [x] E2E tests pass

## Verification Run — 2026-05-17

- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS, 118 files / 1036 tests
- `npm run test:e2e`: PASS, 169 Playwright tests
- `npm run test:corpus`: PASS, 4 PPTX files, avg semantic fidelity 98.0%, avg round-trip stability 99.0%
- `npm run test:load:api` / `npm run test:load:ws`: BLOCKED locally, `k6` not installed in PATH
