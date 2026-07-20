# QA Report — P0 unload-persistence + Phase 9 release gate

**Date:** 2026-07-17  
**Scope:** Focused P0 unload-persistence + Phase 9 continuation gate set  
**Mode:** Diff-aware focused matrix (not full coverage)  
**Verdict:** **PASS**

---

## Gate Results

| # | Gate | Result | Counts | Duration |
|---|------|--------|--------|----------|
| 1 | Focused unit matrix | **PASS** | 14 files / 70 tests | 41.74s |
| 2 | Corpus package-store | **PASS** | 1 file / 3 tests | 6.38s |
| 3 | Playwright e2e (chromium) | **PASS** | 2 tests | 12.9s |
| 4 | Load-test permanent cleanup | **PASS** | 1 match | n/a |

**Final verdict: PASS** — all 4 gates green. 0 failures.

---

## 1. Focused unit matrix — PASS

```
npx vitest run client/src/hooks/editor-controller/ ...
```

| Metric | Value |
|--------|-------|
| Test Files | 14 passed (14) |
| Tests | 70 passed (70) |
| Failed | 0 |
| Duration | 41.74s |

### Files covered

| File | Tests |
|------|-------|
| `use-editor-persistence-controller.test.jsx` | 18 |
| `use-keyboard.test.js` | 12 |
| `editor-autosave-lifecycle.test.jsx` | 9 |
| `use-editor-save-controller.test.jsx` | 7 |
| `editor-page-autosave.characterization.test.jsx` | 5 |
| `editor-panel-keyboard-propagation.test.jsx` | 4 |
| `editor-draft-store.test.js` | 3 |
| `editor-workspace-overlay.test.jsx` | 3 |
| `use-editor-active-slide-controller.test.jsx` | 2 |
| `editor-page-history-autosave.characterization.test.jsx` | 2 |
| `save-recovery-dialog.test.jsx` | 2 |
| `save-conflict-dialog.test.jsx` | 1 |
| `editor-shell.test.jsx` | 1 |
| `editor-page-composition-root.test.js` | 1 |

### Noise (non-blocking)

- React `act(...)` warnings in history/autosave characterization tests (`EditorPage`, `SlideCanvas`)
- Expected stderr from intentional failure paths: `stale generation` (409 STALE_GENERATION), `validation rejected`, `network down`, `request interrupted`, `deck B failed`

No test failures. No stack traces indicating broken assertions.

---

## 2. Corpus package-store — PASS

```
npx vitest run server/services/pptx-import/package-store/corpus-tier-audit.test.js
```

| Metric | Value |
|--------|-------|
| Test Files | 1 passed |
| Tests | 3 passed |
| Duration | 6.38s (tests 4.66s) |

### Cases

1. classifies every complex object and unknown part with explicit result — 1108ms
2. keeps every opaque object relationship closure byte-identical after adjacent edit — 2692ms
3. keeps normalized package-root corpus targets non-dangling — 856ms

---

## 3. Playwright e2e (chromium) — PASS

```
npx playwright test tests/e2e/autosave-oversized-recovery.spec.js tests/e2e/autosave-flush-on-leave.spec.js --project=chromium
```

| Metric | Value |
|--------|-------|
| Workers | 2 |
| Tests | 2 passed |
| Duration | 12.9s |
| Browsers | chromium available |

### Cases

1. **autosave flush on leave** — edit before debounce lands after navigate-away
2. **oversized autosave recovery** — survives reload; requires explicit reconciliation choice

---

## 4. Load-test permanent cleanup — PASS

```
# rg unavailable in pwsh; used workspace grep equivalent
```

**Match (line 53):**
```js
const del = http.del(`${BASE_URL}/presentations/${id}/permanent`, null, params)
```

**Context (lines 43–58):** After 200/201 create, extracts `id` and hard-deletes via `/presentations/${id}/permanent`. Comment documents intent: prevent multi-MB fixture accumulation in `presentations.json` that would inflate rewrite latency under soft-delete.

---

## Coverage / Build

- Full coverage run may be in parallel — not started here (per instructions)
- Server assumed on `:3002` — e2e completed without port conflicts
- No build step in this gate set

---

## Critical Issues

**None.**

---

## Recommendations

1. **Low:** wrap history/autosave characterization state updates in `act()` to silence React warnings (noise only; tests pass)
2. **Info:** expected `Auto-save failed` stderr is intentional — consider `vi.spyOn(console, 'error')` if CI log volume becomes an issue
3. **Info:** k6 permanent cleanup present — good; re-verify if POST profile path changes

---

## Next Steps

1. Green for P0 unload-persistence + Phase 9 focused gate continuation
2. Await full coverage job if still running; do not re-run
3. Proceed to remaining Phase 9 release checklist items outside this focused set

---

## Unresolved Questions

None.
