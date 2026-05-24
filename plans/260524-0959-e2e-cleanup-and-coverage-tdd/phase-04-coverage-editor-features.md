---
phase: 4
title: "P1 Coverage Gap — Editor Features"
status: completed
priority: P1
effort: "5h"
dependencies: [3]
---

# Phase 4: P1 Coverage Gap — Editor Features

## Overview

Close 3 E2E coverage gaps in editor: smart guides, clipboard (cut/copy/paste/duplicate), and element-level hide/show. Each gets its own spec file. Strict TDD: spec fails until Phase 3 testids land and source instrumentation is exposed.

**Scope discipline:** Phase 4 ONLY consumes testids declared in Phase 3 catalog (Groups B/C/D/E). NO new source testids added here — all source testids belong in Phase 3.

## Completion Notes (2026-05-24)

- Added 9 E2E tests across `tests/e2e/canvas/smart-guides.spec.js`, `tests/e2e/canvas/clipboard.spec.js`, and `tests/e2e/canvas/element-hide-show.spec.js`.
- Added `tests/e2e/pages/canvas-actions-helper.js` for seeded editor setup and stable canvas actions.
- Added unit source contracts: `tests/unit/clipboard-offset-source.test.js` and `tests/unit/element-hide-feature-source.test.js`.
- Fixed `EditorPage.jsx` callback adaptation so `PropertiesPanel` can call both selected-element update style and Selection Pane `(id, updates)` style.
- Validation report: `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/editor-coverage-validation.md`.

## Requirements

- New spec: `tests/e2e/canvas/smart-guides.spec.js`
- New spec: `tests/e2e/canvas/clipboard.spec.js`
- New spec: `tests/e2e/canvas/element-hide-show.spec.js`
- Each spec uses `testPresentation` fixture (from `tests/e2e/fixtures/test-fixtures.js`)
- Each spec uses `data-testid` selectors only (per Phase 3 catalog)
- No `waitForTimeout` calls (Phase 2 lint rule)

## Architecture

### Smart Guides (drag-to-align)
- Source: `client/src/components/canvas/use-canvas-snapping-helpers-for-grid-and-smart-guides.js:38`
- Toggle: `client/src/components/ribbon/controls/canvas-controls.jsx:48-57` — Phase 3 adds testid `canvas-controls-toggle-smart-guides`
- Render: `client/src/components/SlideCanvas.jsx` (NOT `client/src/components/canvas/SlideCanvas.jsx` — verified path) — Phase 3 confirms existing `data-testid="smart-guide-x"` / `smart-guide-y"` on guideline DOM nodes

### Clipboard
- Hook: `client/src/hooks/use-clipboard.js:1-182`
- Shortcuts registry: `client/src/utils/default-keyboard-shortcut-definitions-registry.js` (NOT `client/src/data/` — verified path)
- Scope: `'canvas'`
- Operations: Cut (Ctrl+X), Copy (Ctrl+C), Paste (Ctrl+V), Duplicate (Ctrl+D)
- **Verified paste offset:** `use-clipboard.js:45` (duplicate `+20/+20`), `use-clipboard.js:85` (paste `+20/+20`) — both apply +20px in x AND y to avoid stacking pastes

### Element Hide/Show
- Source: `client/src/components/SelectionPane.jsx:177-183` — Eye/EyeOff icon click toggles element-level visibility (NOT slide-level). Phase 3 adds `data-testid="selection-pane-toggle-visibility-${elementId}"` template attr.
- Render filter: `client/src/components/SlideCanvas.jsx` (NOT `client/src/components/canvas/SlideCanvas.jsx`) — hidden elements rendered with `display: none` / `visibility: hidden` (confirm during impl by reading the file)

## Related Code Files

**Create:**
- `tests/e2e/canvas/smart-guides.spec.js`
- `tests/e2e/canvas/clipboard.spec.js`
- `tests/e2e/canvas/element-hide-show.spec.js`
- `tests/e2e/pages/canvas-actions-helper.js` (extracted in Refactor step)

**Read for context (no edits — testids added in Phase 3):**
- `client/src/components/SlideCanvas.jsx` — verify `data-testid="smart-guide-x"` actually present
- `client/src/components/canvas/use-canvas-snapping-helpers-for-grid-and-smart-guides.js` — threshold values
- `client/src/hooks/use-clipboard.js:45, 85` — verify +20/+20 offset preserved
- `client/src/components/SelectionPane.jsx:177-183` — Eye icon DOM (testid added in Phase 3)

**Testids consumed from Phase 3 catalog (read-only):**
| testid | Group | Used by spec |
|---|---|---|
| `canvas-area` | D | smart-guides, clipboard, element-hide-show |
| `ribbon-tab-insert` | B | all three |
| `ribbon-tab-view` | B | smart-guides, element-hide-show |
| `ribbon-insert-text` | C | all three |
| `canvas-controls-toggle-smart-guides` | D | smart-guides |
| `smart-guide-x` / `smart-guide-y` | D | smart-guides |
| `view-toggle-selection-pane` | E | element-hide-show |
| `selection-pane-toggle-visibility-${id}` | E | element-hide-show |

## Implementation Steps

### Red — Smart Guides

1. Write `tests/e2e/canvas/smart-guides.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';

   test.describe('smart guides', () => {
     test('toggle visible in ribbon View tab', async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       await page.locator('[data-testid="ribbon-tab-view"]').click();
       const toggle = page.locator('[data-testid="canvas-controls-toggle-smart-guides"]');
       await expect(toggle).toBeVisible();
     });

     test('shows guide when element drags near sibling edge', async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       await page.locator('[data-testid="ribbon-tab-insert"]').click();
       await page.locator('[data-testid="ribbon-insert-text"]').click();
       await page.locator('[data-testid="canvas-area"]').click({ position: { x: 100, y: 100 } });
       await page.locator('[data-testid="ribbon-insert-text"]').click();
       await page.locator('[data-testid="canvas-area"]').click({ position: { x: 300, y: 200 } });

       const box2 = page.locator('[data-element-type="text"]').nth(1);
       await box2.dragTo(page.locator('[data-testid="canvas-area"]'), {
         targetPosition: { x: 100, y: 200 }, // x matches box1
       });

       // Smart guide flashes during drag — poll opacity instead of timeout
       await expect.poll(
         () => page.locator('[data-testid="smart-guide-x"]').evaluate(el => el ? getComputedStyle(el).opacity : '0'),
         { intervals: [50], timeout: 2000 }
       ).not.toBe('0');
     });

     test('snapping toggle off → no guides', async ({ page, testPresentation }) => {
       // similar; click toggle off first; assert smart-guide-x stays opacity 0
     });
   });
   ```

### Red — Clipboard

2. Write `tests/e2e/canvas/clipboard.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';

   test.describe('clipboard', () => {
     test('Ctrl+C then Ctrl+V duplicates element', async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       await page.locator('[data-testid="ribbon-tab-insert"]').click();
       await page.locator('[data-testid="ribbon-insert-text"]').click();
       await page.locator('[data-testid="canvas-area"]').click({ position: { x: 100, y: 100 } });
       await expect(page.locator('[data-element-type="text"]')).toHaveCount(1);
       await page.keyboard.press('Control+C');
       await page.keyboard.press('Control+V');
       await expect(page.locator('[data-element-type="text"]')).toHaveCount(2);
     });

     test('Ctrl+X removes selected then Ctrl+V restores', async ({ page, testPresentation }) => {
       // ... setup ...
       await page.keyboard.press('Control+X');
       await expect(page.locator('[data-element-type="text"]')).toHaveCount(0);
       await page.keyboard.press('Control+V');
       await expect(page.locator('[data-element-type="text"]')).toHaveCount(1);
     });

     test('Ctrl+D duplicates in-place with +20/+20 offset', async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       await page.locator('[data-testid="ribbon-tab-insert"]').click();
       await page.locator('[data-testid="ribbon-insert-text"]').click();
       await page.locator('[data-testid="canvas-area"]').click({ position: { x: 100, y: 100 } });

       const original = page.locator('[data-element-type="text"]').first();
       const before = await original.boundingBox();
       await page.keyboard.press('Control+D');
       await expect(page.locator('[data-element-type="text"]')).toHaveCount(2);

       const duplicate = page.locator('[data-element-type="text"]').nth(1);
       const after = await duplicate.boundingBox();
       // Verified offset at use-clipboard.js:45 = +20/+20
       expect(Math.round(after.x - before.x)).toBe(20);
       expect(Math.round(after.y - before.y)).toBe(20);
     });

     test('Ctrl+V paste applies +20/+20 offset from source', async ({ page, testPresentation }) => {
       // ... setup ...
       const original = page.locator('[data-element-type="text"]').first();
       const before = await original.boundingBox();
       await page.keyboard.press('Control+C');
       await page.keyboard.press('Control+V');
       const pasted = page.locator('[data-element-type="text"]').nth(1);
       const after = await pasted.boundingBox();
       // Verified at use-clipboard.js:85
       expect(Math.round(after.x - before.x)).toBe(20);
       expect(Math.round(after.y - before.y)).toBe(20);
     });
   });
   ```

### Red — Hide/Show

3. Write `tests/e2e/canvas/element-hide-show.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';

   test.describe('element hide/show', () => {
     test('Eye icon toggles element visibility on canvas', async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       await page.locator('[data-testid="ribbon-tab-insert"]').click();
       await page.locator('[data-testid="ribbon-insert-text"]').click();
       await page.locator('[data-testid="canvas-area"]').click({ position: { x: 100, y: 100 } });

       await page.locator('[data-testid="ribbon-tab-view"]').click();
       await page.locator('[data-testid="view-toggle-selection-pane"]').click();

       const eyeToggle = page.locator('[data-testid^="selection-pane-toggle-visibility-"]').first();
       await eyeToggle.click();

       await expect(page.locator('[data-element-type="text"]')).toBeHidden();

       await eyeToggle.click();
       await expect(page.locator('[data-element-type="text"]')).toBeVisible();
     });

     test('hidden element persists across reload', async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       // insert + hide as above
       await page.keyboard.press('Control+S');
       // Wait for save response instead of arbitrary timeout
       await page.waitForResponse(r => /\/api\/presentations\/[^/]+$/.test(r.url()) && r.request().method() === 'PUT');
       await page.reload();
       await expect(page.locator('[data-element-type="text"]')).toBeHidden();
     });
   });
   ```

4. Run each new spec → expect failures (Red phase)

### Green

5. For each failing assertion, trace to source. Most failures should resolve once Phase 3 lands its testid catalog. Specific gaps:
   - If `smart-guide-x` doesn't appear → verify `SlideCanvas.jsx` actually emits it; may need bug fix (separate from this plan if so)
   - If `+20/+20` offset assertion fails → re-verify `use-clipboard.js:45, 85` source (offset may have drifted)
   - If clipboard fails on Linux CI → confirm `use-clipboard.js` uses internal store (NOT navigator.clipboard) — no browser permission prompt expected

6. Make minimal source changes; re-run; iterate

### Refactor

7. Extract common setup (`insertText`, `selectElement`, `openSelectionPane`) to `tests/e2e/pages/canvas-actions-helper.js`
8. Apply across all 3 specs

## Success Criteria

- [x] `smart-guides.spec.js` 3 tests green
- [x] `clipboard.spec.js` 4 tests green (incl. +20/+20 offset assertion)
- [x] `element-hide-show.spec.js` 2 tests green
- [x] Zero `waitForTimeout` in new specs
- [x] All new specs use `testPresentation` fixture (cleanup-safe)
- [x] Total new test count: 9 added
- [x] Zero source-side testid additions (all done in Phase 3)

## Tests (verification)

The specs above ARE the tests. Additional unit checks:

```js
// tests/unit/clipboard-offset-source.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('clipboard hook offset constants', () => {
  const src = readFileSync('client/src/hooks/use-clipboard.js', 'utf8');

  it('paste offset is +20/+20', () => {
    // Verified at lines 45 and 85 — pattern must include both x and y deltas of 20
    expect(src).toMatch(/x:\s*[^,]+\+\s*20/);
    expect(src).toMatch(/y:\s*[^,]+\+\s*20/);
  });
});
```

```js
// tests/unit/element-hide-feature-source.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('element hide/show wiring', () => {
  it('SelectionPane exposes visibility toggle testid', () => {
    const src = readFileSync('client/src/components/SelectionPane.jsx', 'utf8');
    expect(src).toMatch(/data-testid=["`']selection-pane-toggle-visibility/);
  });

  it('SlideCanvas filters hidden elements', () => {
    // VERIFIED path: client/src/components/SlideCanvas.jsx (NO canvas/ subdir)
    const src = readFileSync('client/src/components/SlideCanvas.jsx', 'utf8');
    expect(src).toMatch(/element\.hidden|element\.isVisible|visible:\s*false/);
  });
});
```

## Risk Assessment

- **Risk:** smart-guide DOM is volatile (only visible during drag). Mitigation: `expect.poll` on opacity instead of `toBeVisible` to catch the brief flash; no `waitForTimeout` needed.
- **Risk:** Clipboard internal store vs navigator.clipboard behaviour difference between dev and prod build. Mitigation: verify `use-clipboard.js` returns true for internal store path (no browser permission prompt expected).
- **Risk (RESOLVED post-audit):** Wrong path `client/src/components/canvas/SlideCanvas.jsx`. Mitigation: corrected to `client/src/components/SlideCanvas.jsx` everywhere; verified via Glob.
- **Risk (RESOLVED post-audit):** Wrong path `client/src/data/default-keyboard-shortcut-definitions-registry.js`. Mitigation: corrected to `client/src/utils/...` everywhere.
- **Risk:** `+20/+20` offset constant changes in source. Mitigation: unit test `clipboard-offset-source.test.js` guards the regex; updates flow automatically.
- **Risk:** Save-then-reload race in hide/show persistence test. Mitigation: `page.waitForResponse(PUT /api/presentations/:id)` instead of arbitrary delay.

## Next Steps

- Phase 5 (export/import) reuses `canvas-actions-helper.js`
- Phase 7 may move helper utilities further (consider after Phase 5 lands)
