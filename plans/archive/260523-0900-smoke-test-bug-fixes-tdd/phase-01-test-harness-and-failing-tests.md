---
phase: 1
title: "Test Harness & Failing Tests"
status: pending
priority: P0
effort: "4-6h"
dependencies: []
---

# Phase 1: Test Harness & Failing Tests (RED)

## Overview

Land all 5 failing regression tests for I-001..I-005 upfront. Nothing else in this phase. The fix phases (2–6) cannot start until every test exists, runs, and fails for the documented reason.

This is the **RED** half of TDD. Subsequent phases provide the GREEN.

## Requirements

### Functional
- One Vitest unit test per backend issue (I-002 schema, I-005 atomic write).
- One Playwright E2E test per frontend issue (I-001 sidebar, I-003 Ctrl+K, I-004 footer).
- All five tests must fail when first committed — failure mode must match the documented root cause.
- Tests live next to existing peers (do not invent new dirs).

### Non-functional
- Each test runs in < 5s isolated.
- Tests are deterministic (no `setTimeout` longer than necessary, no flaky waits).
- Tests do not depend on production `server/data/presentations.json` — use isolated `SLIDES_DATA_DIR` per Playwright run (already implemented in `playwright.config.js`).

## Architecture

```
tests/e2e/regression-smoke-fixes.spec.js         (NEW, Playwright)
├─ Test I-001: Trash sidebar entry is visible after dashboard load
├─ Test I-003: Ctrl+K opens command palette in editor
└─ Test I-004: Footer displays version matching package.json

server/services/storage.test.js                  (NEW, Vitest)
└─ Test I-005: writePresentations is atomic under simulated crash

server/routes/presentations.test.js              (EXTEND, Vitest)
└─ Test I-002: legacy element without x/y/w/h saves successfully
```

## Related Code Files

- Create: `tests/e2e/regression-smoke-fixes.spec.js`
- Create: `server/services/storage.test.js`
- Modify: `server/routes/presentations.test.js` (add new `it()` block; do NOT rewrite existing)
- Read for context: `server/middleware/schemas.js`, `server/services/storage.js`, `client/src/pages/HomePage.jsx`, `client/src/components/layout/StatusBar.jsx`, `client/src/pages/EditorPage.jsx`, `playwright.config.js`

## Implementation Steps

### Step 1.1 — I-002 RED: Legacy fixture save test (with saved-record assertion per Red Team Finding 9)

In `server/routes/presentations.test.js`, append a new `describe('Legacy fixture compatibility', ...)` block at the bottom:

```js
import fs from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Legacy fixture compatibility (I-002)', () => {
  it('accepts elements that omit x/y/w/h and persists defaults', async () => {
    const app = createApp()
    const createRes = await request(app).post('/api/presentations').send({
      title: 'Legacy fixture test',
      slides: [
        {
          id: 'slide-legacy',
          elements: [
            // Element shape from a pre-geometry-required era
            { id: 'el-legacy', type: 'text', content: '<p>Legacy</p>' },
          ],
        },
      ],
    })
    expect(createRes.status).toBe(201)

    // GREEN must persist defaults — not just accept the request.
    const id = createRes.body.id
    const fetched = await request(app).get(`/api/presentations/${id}`)
    expect(fetched.status).toBe(200)
    const el = fetched.body.slides[0].elements[0]
    expect(el).toMatchObject({
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    })

    // PUT path: also surfaced the original bug. Mutate one element + add a fresh
    // legacy element and ensure round-trip still applies defaults.
    const updateRes = await request(app)
      .put(`/api/presentations/${id}`)
      .send({
        title: fetched.body.title,
        slides: [
          {
            id: 'slide-legacy',
            elements: [
              el, // already-defaulted
              { id: 'el-legacy-2', type: 'text', content: '<p>Legacy 2</p>' },
            ],
          },
        ],
      })
    expect(updateRes.status).toBe(200)
    const reFetched = await request(app).get(`/api/presentations/${id}`)
    expect(reFetched.body.slides[0].elements[1]).toMatchObject({
      type: 'text',
      x: 0, y: 0, width: 100, height: 100,
    })
  })

  it('accepts the canonical legacy fixture from disk', async () => {
    const fixturePath = path.join(__dirname, '__fixtures__', 'legacy-deck-no-geometry.json')
    const fixture = await fs.readJson(fixturePath)
    const app = createApp()
    const res = await request(app).post('/api/presentations').send(fixture)
    expect(res.status).toBe(201)
  })
})
```

Also create the on-disk fixture so the second case has a real, reviewable payload (Red Team Finding 4 — inline shapes alone are brittle):

`server/routes/__fixtures__/legacy-deck-no-geometry.json`:

```json
{
  "title": "Legacy fixture (no geometry)",
  "slides": [
    {
      "id": "slide-1",
      "elements": [
        { "id": "el-1", "type": "text", "content": "<p>Title slide</p>" },
        { "id": "el-2", "type": "text", "content": "<p>Subtitle</p>" }
      ]
    },
    {
      "id": "slide-2",
      "elements": [
        { "id": "el-3", "type": "shape", "shapeType": "rect" }
      ]
    }
  ]
}
```

Expected RED (both cases): 400 validation error citing `Required` for `x`, `y`, `width`, `height`.

### Step 1.2 — I-005 RED: Atomic write test (rewritten per Red Team Findings 1 & 2)

**Two flaws in the original draft:**
- `require.cache` / `require.resolve` are CommonJS-only and have no effect in Vitest's ESM runner. The storage module's module-scope `DATA_DIR = process.env.SLIDES_DATA_DIR || path.join(...)` resolves on first import — too late to override later.
- Calling `Promise.all([...writes, ...reads])` then `Promise.all(reads)` again exhausts the `reads` array and asserts on the already-settled promises (still works, but the double-`await` confused intent).

**Approach (ESM-safe + true crash simulation):**

The test has two complementary parts:
1. **Race test** in-process: assert that no concurrent read sees corrupted JSON during many overlapping writes. Driven via `vi.resetModules()` + dynamic `import()` so each test gets a fresh storage module bound to the per-test `SLIDES_DATA_DIR`.
2. **Crash test** out-of-process: spawn a Node child that begins a write loop and kill it with SIGKILL. Verify the on-disk file still parses as valid JSON. This is the only way to actually exercise atomic semantics — an in-process race cannot interrupt `fs.writeJson` mid-syscall.

Create `server/services/storage.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe('Storage atomic writes (I-005)', () => {
  let tmpDir
  let originalDataDir

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-atomic-'))
    originalDataDir = process.env.SLIDES_DATA_DIR
    process.env.SLIDES_DATA_DIR = tmpDir
  })

  afterEach(async () => {
    if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = originalDataDir
    await fs.remove(tmpDir).catch(() => {})
  })

  async function freshStorage() {
    // ESM-safe re-import: cache-bust via query string so DATA_DIR
    // re-evaluates against the per-test SLIDES_DATA_DIR.
    const url = new URL(`./storage.js?t=${Date.now()}-${Math.random()}`, import.meta.url)
    const mod = await import(url.href)
    mod.initDataFiles()
    return mod
  }

  it('concurrent reads never observe truncated JSON during many writes', async () => {
    const storage = await freshStorage()
    const dataFile = path.join(tmpDir, 'presentations.json')

    // Seed
    await storage.writePresentations([{ id: 'pres-0', title: 'Seed', slides: [] }])

    // Interleave 25 writes with 100 reads
    const errors = []
    const writes = Array.from({ length: 25 }, (_, i) =>
      storage.writePresentations([{ id: `pres-${i}`, title: `W${i}`, slides: [] }])
    )
    const reads = Array.from({ length: 100 }, async () => {
      try {
        const data = await fs.readJson(dataFile)
        if (!Array.isArray(data)) errors.push('not-array')
      } catch (err) {
        errors.push(err.message)
      }
    })
    await Promise.all([...writes, ...reads])

    expect(errors, `no read should observe a truncated/invalid JSON state: ${errors.join(', ')}`).toEqual([])
  })

  it('SIGKILL mid-write leaves valid JSON on disk', async () => {
    // Child spawns a process that writes in a tight loop. Parent SIGKILLs after a delay.
    const childScript = path.join(__dirname, '__storage-crash-child.cjs')

    // Write the child driver inline so the test is self-contained
    await fs.writeFile(childScript, `
const path = require('path')
const { pathToFileURL } = require('url')
process.env.SLIDES_DATA_DIR = ${JSON.stringify(tmpDir)}
;(async () => {
  const storage = await import(pathToFileURL(path.join(${JSON.stringify(__dirname)}, 'storage.js')).href)
  storage.initDataFiles()
  let i = 0
  while (true) {
    await storage.writePresentations([{ id: 'p-' + (i++), title: 'crash-' + i, slides: [] }])
  }
})().catch((e) => { console.error(e); process.exit(2) })
`)

    const child = spawn(process.execPath, [childScript], { stdio: ['ignore', 'ignore', 'pipe'] })
    await new Promise((resolve) => setTimeout(resolve, 250)) // let it write a few hundred times
    child.kill('SIGKILL')
    await new Promise((resolve) => child.on('exit', resolve))

    const dataFile = path.join(tmpDir, 'presentations.json')
    // Either file is the seed (initDataFiles created []), or a valid write.
    // What it must NOT be: a partial / unparseable JSON.
    const raw = await fs.readFile(dataFile, 'utf8').catch(() => '[]')
    expect(() => JSON.parse(raw), 'presentations.json must parse as valid JSON after SIGKILL').not.toThrow()
    const parsed = JSON.parse(raw)
    expect(Array.isArray(parsed)).toBe(true)

    await fs.remove(childScript).catch(() => {})
  })
})
```

Expected RED with current non-atomic `fs.writeJson`:
- Race test: at least one read observes `Unexpected end of JSON input` or empty file → assertion fails.
- SIGKILL test: with raw `fs.writeJson`, on a SIGKILL during a write the file is in a partial-write state and `JSON.parse` throws.

Expected GREEN after Phase 3:
- Race test: every read sees either old or new content. Atomic rename preserves the last fully-written snapshot.
- SIGKILL test: file always parses; either contains seed or a completed write.

**Note on dual-test design:** the race test catches the common-case in-process bug; the SIGKILL test is the canonical proof of atomicity. Keep both — neither alone is sufficient.

### Step 1.3 — Frontend regression Playwright spec

Create `tests/e2e/regression-smoke-fixes.spec.js`:

```js
import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'))

test.describe('Regression — smoke test fixes', () => {
  test('I-001: Trash entry is visible in dashboard sidebar', async ({ page }) => {
    await page.goto('/')
    const trashBtn = page.getByRole('button', { name: /trash/i })
    await expect(trashBtn).toBeVisible()
    await expect(trashBtn).toBeInViewport()
  })

  test('I-003: Ctrl+K opens the command palette in editor', async ({ page }) => {
    // Create deck via UI flow
    await page.goto('/')
    await page.getByRole('button', { name: /new presentation/i }).first().click()
    await page.waitForURL(/\/editor\//)
    // Focus the canvas surface
    await page.locator('body').click()
    await page.keyboard.press('Control+K')
    await expect(page.getByRole('dialog', { name: /command palette/i })).toBeVisible({ timeout: 2000 })
  })

  test('I-004: Footer version matches package.json', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer')
    await expect(footer).toContainText(`v${pkg.version}`)
  })
})
```

Expected RED:
- I-001 will pass on a fresh dashboard most of the time, but fails when sidebar overflow hides the entry — capture both states by adding a viewport variant: `test.use({ viewport: { width: 1280, height: 600 } })` if intermittent.
- I-003 may fail because a TipTap rich-text frame's keymap consumed Ctrl+K before the window-level shortcut listener received it. **If the test passes in real-browser Playwright** (it well might), Phase 5 closes I-003 as agent-browser infra noise with this test as the regression guard.
- I-004 fails because footer is hardcoded `v1.6.1`.

### Step 1.4 — Verify all five tests fail

Run:

```powershell
npx vitest run server/services/storage.test.js
npx vitest run server/routes/presentations.test.js --grep "Legacy fixture"
npx playwright test tests/e2e/regression-smoke-fixes.spec.js
```

Each must fail. Save failure logs to `plans/260523-0900-smoke-test-bug-fixes-tdd/reports/phase-01-red-evidence.md`.

### Step 1.5 — Commit RED tests

```text
test(regression): add failing tests for smoke-test issues I-001..I-005
```

Phase ends with all 5 tests in repo, all 5 failing for the documented reason.

## Success Criteria

- [ ] `server/routes/presentations.test.js` extended with I-002 case; fails with 400 + `Required` error
- [ ] `server/services/storage.test.js` created with I-005 case; fails by observing truncated read
- [ ] `tests/e2e/regression-smoke-fixes.spec.js` created with 3 cases (I-001, I-003, I-004); all 3 fail
- [ ] Failure outputs captured in `reports/phase-01-red-evidence.md`
- [ ] No production code changed in this phase (only test files)
- [ ] `npm run lint` passes on the new test files

## Risk Assessment

| Risk | Mitigation |
|---|---|
| I-005 test passes accidentally because OS schedules writes serially | Use `Promise.all` and many writers; assert on actual read error count, not timing |
| I-001 test passes in headless because viewport is full-height | Add an explicit small-viewport variant to force the failure mode |
| I-003 test passes because Playwright canvas focus differs from agent-browser | Document outcome either way — passing here proves smoke-test miss was infra noise |
| Adding tests to existing `presentations.test.js` breaks unrelated cases | Use a new `describe` block; do not touch existing code |

## Security Considerations

- Tests use isolated temp dirs (storage test) and Playwright per-run data dir. No production data touched.
- No secrets, no real network calls, no third-party APIs.

## Red Team Adjustment

### Session 2 — 2026-05-23 (post-draft review)

| Finding | Severity | Disposition | Applied |
|---|---|---|---|
| 1. Original I-005 test used `require.cache` + CJS `require()` in Vitest ESM runner — silently no-ops | Critical | Accept | Step 1.2 rewritten: `vi.resetModules()` + dynamic `import()` with cache-busting query string |
| 2. Original I-005 test set `SLIDES_DATA_DIR` after the module's `DATA_DIR` had already resolved on first import elsewhere — fell back to dev `server/data` and could corrupt real data | Critical | Accept | Step 1.2 now uses dynamic import inside `beforeEach` so `DATA_DIR` resolves AFTER the env var is set |
| 4. Inline fixture shapes are brittle — real bug came from a real fixture file | High | Accept | Added on-disk fixture `server/routes/__fixtures__/legacy-deck-no-geometry.json` + second test case that loads it |
| 9. I-002 test only asserted 201/200 — would pass even if defaults silently dropped the elements | Medium | Accept | Step 1.1 now asserts the saved record has `x=0, y=0, width=100, height=100` on every element that omitted them |

Race test alone is insufficient (in-process concurrency does not interrupt syscalls) — added a true crash test via spawned child + SIGKILL to exercise atomic semantics end-to-end.

## Next Steps

Phase 2, 3, 4, 5, 6 (parallel by lane). All depend on this phase landing first.
