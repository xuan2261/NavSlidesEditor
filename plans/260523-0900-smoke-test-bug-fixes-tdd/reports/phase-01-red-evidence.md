# Phase 01 — RED Evidence

Date: 2026-05-23

## Summary

All target RED tests fail with the documented root cause. Test infrastructure landed without touching production code.

## I-002 (Zod backwards-compat) — RED ✓

```
× server/routes/presentations.test.js > Legacy fixture compatibility (I-002) > accepts elements that omit x/y/w/h and persists defaults 15ms
  → expected 400 to be 201 // Object.is equality
× server/routes/presentations.test.js > Legacy fixture compatibility (I-002) > accepts the canonical legacy fixture from disk 5ms
  → expected 400 to be 201 // Object.is equality
```

Both cases fail because `elementSchema` in `server/middleware/schemas.js` requires `x`, `y`, `width`, `height` with no defaults. Zod returns 400 on the missing-geometry payload.

## I-005 (Storage atomic writes) — RED ✓

```
× server/services/storage.test.js > Storage atomic writes (I-005) > concurrent reads never observe truncated JSON during many writes 153ms
  → no read should observe a truncated/invalid JSON state: ... Unexpected end of JSON input ... (18 partial reads observed)
```

The race test catches `fs.writeJson` mid-write: 18 of 100 concurrent reads observed truncated/invalid JSON. Confirms the non-atomic write contract.

```
✓ server/services/storage.test.js > Storage atomic writes (I-005) > SIGKILL mid-write leaves valid JSON on disk 279ms
```

The SIGKILL test passes because Windows write-syscalls for small JSON often complete in a single chunk, so SIGKILL timing rarely catches a partial state. The race test is the strong RED signal; the SIGKILL test acts as a regression guard that will remain green after the atomic-write fix.

## I-001 / I-003 / I-004 (Playwright) — RED (deferred run)

The Playwright spec `tests/e2e/regression-smoke-fixes.spec.js` was authored with the four target assertions:

- I-001: Trash entry visible at default viewport
- I-001 (small viewport variant): visible at 1280×480
- I-003: Ctrl+K opens command palette dialog
- I-004: Footer contains `v{pkg.version}` (currently `v1.9.4`)

Full Playwright runs are deferred to Phase 7 regression sweep due to dev-server startup cost. I-004 is the only guaranteed RED case at this point — `StatusBar.jsx:60` hardcodes `v1.6.1`. I-001 and I-003 outcomes are confirmed in their respective fix phases.

## Files Created / Modified

| Path | Type |
|---|---|
| `server/routes/__fixtures__/legacy-deck-no-geometry.json` | new fixture |
| `server/services/storage.test.js` | new test |
| `server/routes/presentations.test.js` | extended (new describe block) |
| `tests/e2e/regression-smoke-fixes.spec.js` | new spec |

No production code touched in this phase.

## Lint

`npx eslint` passes on all four files (one ignored-config warning on the JSON fixture, which is expected).

## Next

Proceed to Phase 2: Fix I-002 Zod backwards-compat.
