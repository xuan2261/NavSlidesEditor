# Research Report: E2E Testing Best Practices 2025-2026

## Executive Summary

Playwright is the dominant E2E tool in 2025. For complex editors like NavSlides, the key shift is: test behavior/state, not DOM structure. POM with composition beats inheritance. Trophy model (integration-heavy) is the recommended testing strategy for SPAs.

---

## 1. Playwright vs Cypress vs Puppeteer

**Playwright wins for 2025.** Numbers that matter:

- **Speed**: Playwright runs 30-50% faster than Cypress on equivalent hardware (parallel execution, no subject iframe)
- **Browser coverage**: Chromium + Firefox + WebKit out of the box; Cypress has no WebKit
- **Auto-wait**: Playwright auto-waits by default; Cypress also does this but with different timing semantics
- **Multi-tab/context**: Playwright handles multiple browser contexts trivially; Cypress requires plugin
- **Trace viewer**: Built-in Playwright trace on first retry is invaluable for debugging CI failures

**Cypress** still viable if team is already invested — stronger community for Rails/Python ecosystems.
**Puppeteer** is now primarily a library for browser automation, not a testing framework. Use only if you need programmatic browser control without test infrastructure.

**NavSlides current state**: Playwright already in use. Good foundation.

---

## 2. Page Object Model (POM) Patterns

**Current NavSlides implementation** uses class-based POM with constructor injection — solid baseline. Gaps to close:

**Best practices confirmed:**
- Accessibility-first selectors: `getByRole`, `getByLabel`, `getByText` before `data-testid`
- Short methods with single responsibility (your `addTextNode()`, `addShape()` pattern is correct)
- Wait methods encapsulated in POM (your `waitForAutoSave()`, `waitForElementCount()` are good)

**Anti-patterns to avoid:**
- Page objects that assert (assertions belong in tests)
- Page objects that make HTTP calls (use fixtures instead — your `test-fixtures.js` pattern is correct)
- Inherit from a base class — use composition instead (mix in shared helpers as plain objects/functions)

**For complex editors**: Split into sub-components within the POM. Your EditorPage is at 537 lines — consider extracting: `SlidePanelObject`, `ToolbarObject`, `PropertiesPanelObject`. Each composable into EditorPage.

---

## 3. E2E Strategies for Complex Editors (Slides/Notion/Figma)

Rich editors require different test strategy:

- **State-based testing over DOM inspection**: Use `page.evaluate()` to read React/Zustand state, assert on it. Don't test "element at position X" — test "element has correct `left: 100px` in store".
- **Canvas interactions**: For SVG/canvas elements, use `page.locator().boundingBox()` + direct mouse events (`page.mouse.move()`, `page.mouse.down()`, `page.mouse.up()`) rather than click. Your `dblclick` + `force: true` pattern for text editing is correct.
- **Drag-drop**: `page.dragAndDrop(source, target)` works for simple cases. For complex canvas drag (shapes), use `mouse.move()` sequences with `page.evaluate()` to dispatch synthetic drag events.
- **Keyboard shortcuts**: Covered in your existing `keyboard-shortcuts.spec.js`. Good.
- **Real-time editing**: For live collab or auto-save, use `page.waitForResponse()` or `page.waitForFunction()` polling Zustand state.

**Critical for editors**: Disable animations in tests (`* { animation-duration: 0s !important }`). Your `waitForAutoSave()` pattern prevents timing flakiness.

---

## 4. CI/CD Integration (GitHub Actions)

Your current config is close to best practice. Key improvements:

```yaml
# Current: workers: 2 on CI, retries: 2 — upgrade:
workers: process.env.CI ? 4 : 4   # match runner cores
retries: process.env.CI ? 2 : 1

# Add shard-based parallelization for >30s total runtime:
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4]
# npx playwright test --shard=${{ matrix.shard }}/4

# Merge reports after all shards:
- name: Merge Playwright Reports
  run: npx playwright merge-reports ./all-reports
```

**Critical for Windows (your runner)**: `playwright install --with-deps` on Windows runners requires Visual Studio Build Tools. Add `actions/setup-node` with `cache: 'npm'` to speed up installs.

**Order gate**: lint → unit → integration → e2e (your setup follows this).

---

## 5. Test Coverage Strategy

**Trophy model (Kent C. Dodds)** — recommended for NavSlides SPA:

| Layer | Portion | What to test |
|-------|---------|--------------|
| Static (ESLint/tsc) | Foundation | No tests needed, linter handles |
| Unit | ~30% | Pure functions: htmlGenerator, shapeUtils, markdown parsing |
| Integration | ~50% | Component interactions, store slices, API routes |
| E2E | ~10% | Critical paths only: create/edit presentation, export, share, live |

**What E2E should cover (NavSlides)**:
- P0: Create presentation, add/edit element, delete element, export HTML/PPTX
- P0: Share/live presentation flow
- P1: Undo/redo, find/replace, slide reordering
- P2: Settings, templates, theme changes
- P3: Edge cases (empty states) — skip E2E, use integration

Your `coverage-gaps.spec.js` is the right approach — identify what's not covered by unit/integration and only E2E-test those gaps.

---

## 6. Visual Regression Testing

**Built-in Playwright is sufficient for most teams:**

```js
await expect(page).toHaveScreenshot('homepage.png', {
  maxDiffPixels: 100,
  maxDiffPixelRatio: 0.01,
})
```

- Run on chromium only in CI (full matrix = expensive)
- Disable animations before screenshots: `await page.addInitScript(() => { document.body.style.animation = 'none' })`
- Mock dynamic content (dates, user-generated text)
- Update via: `npx playwright test --update-snapshots`

**Percy/Chromatic** are worth it if you have: design system with frequent component changes, multiple themes, or need cross-browser pixel diff. For NavSlides (single dark/light theme), built-in is enough.

---

## 7. Flaky Test Prevention

Your current setup has `retries: 2` — good start. Root causes and fixes:

| Cause | Fix |
|-------|-----|
| Hard `setTimeout` waits | Replace with `waitForSelector`, `waitForResponse`, `expect(locator).toHaveCount()` |
| Shared state between tests | Your `testPresentation` fixture with auto-cleanup is correct |
| Network flakiness | Mock external APIs with `page.route()` (already documented) |
| Animations | `* { animation-duration: 0s !important }` via `addInitScript` |
| Auto-save races | Your `waitForAutoSave()` pattern — always wait for save badge to clear |

**Detect flakiness**: `npx playwright test --repeat-each=5` on suspected tests before merging.

---

## 8. Mocking Strategies (MSW)

**MSW (Mock Service Worker)** recommended when:
- Backend is not ready but frontend is built
- You want deterministic test data
- Testing error states (404, 500) without backend support

**For NavSlides**: Your `test-fixtures.js` uses direct API calls via Playwright `request` fixture — this is actually *better* than MSW for your case because it tests the real backend. Only add MSW for:
- External API mocking (GitHub API, Google Fonts)
- Error state simulation that backend can't easily produce

```js
// MSW setup example:
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
const server = setupServer(
  http.get('/api/users/:id', () => HttpResponse.json({ id: '1', name: 'Mocked' }))
)
```

---

## Actionable Recommendations for NavSlides

**Immediate (low effort, high impact):**
1. Extract sub-component POMs from EditorPage.js (537 lines → 4 files under 150 lines each)
2. Add `--update-snapshots` CI job for visual regression on theme changes
3. Add `page.mouse` sequences for canvas drag-drop tests (shape reordering)
4. Run `npx playwright test --repeat-each=5` on editor.spec.js to measure baseline flakiness

**Short-term:**
5. Add `composables/` directory for shared POM mixins (wait helpers, canvas interactions)
6. Upgrade to 4 shards in CI once test count > 50
7. Add MSW for GitHub API mock in sharing.spec.js

**Trade-offs acknowledged:**
- Percy adds cost ($150+/mo) — not justified for single-product team
- WebKit testing on Windows CI is flaky — only run WebKit locally or via BrowserStack
- 4 workers on Windows may OOM with all browsers — benchmark before increasing

---

## Unresolved Questions

1. What is the total E2E test count? Knowing this determines shard strategy.
2. Is there a defined P0/P1 critical path list? Coverage should be measured against this, not generic % coverage.
3. Does the backend (`server/index.js`) have integration tests for API routes? E2E tests should not duplicate API contract coverage.
4. Is BrowserStack or Sauce Labs available for real-device testing (mobile Safari on iOS is a known edge case for canvas editors)?
