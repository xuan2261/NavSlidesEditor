# Phase 02 — GREEN Evidence (I-002 Zod backwards-compat)

Date: 2026-05-23

## Summary

I-002 fix applied in `server/middleware/schemas.js` — added `.default()` calls on the four geometry fields of `elementSchema`. All RED tests now pass; existing 4 tests in the suite remain green.

## Change Applied

`server/middleware/schemas.js`, `elementSchema` block (lines 33-43):

```js
const elementSchema = z
  .object({
    id: z.string().optional(),
    type: z.union([builtInElementTypeSchema, pluginElementTypeSchema]),
    x: z.number().default(0),
    y: z.number().default(0),
    width: z.number().positive().default(100),
    height: z.number().positive().default(100),
    zIndex: z.number().int().optional(),
  })
  .passthrough()
```

`.positive()` preserved on `width`/`height` so zero/negative still rejects (real bug guard, not legacy data). Defaults only fill *missing* fields, not invalid ones.

## Targeted Run — Legacy Fixture tests

```
$ npx vitest run server/routes/presentations.test.js -t "Legacy fixture"

 Test Files  1 passed (1)
      Tests  2 passed | 4 skipped (6)
   Duration  2.56s
```

Both cases pass:
- `accepts elements that omit x/y/w/h and persists defaults` — POST returns 201, GET round-trips persisted `{x:0, y:0, width:100, height:100}`. PUT path also verified.
- `accepts the canonical legacy fixture from disk` — 2 slides × 3 elements load from `__fixtures__/legacy-deck-no-geometry.json`; persisted record has numeric geometry on every element.

## Full Regression — presentations.test.js

```
$ npx vitest run server/routes/presentations.test.js

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  2.68s
```

All 6 tests green:
1. covers CRUD, trash/restore, duplicate, export, present, save-as-template
2. returns 404 for missing presentation mutations and lookup
3. accepts persisted plugin elements in presentation payloads
4. removes both legacy and object-format share tokens on permanent delete
5. **Legacy fixture (I-002): accepts elements that omit x/y/w/h and persists defaults** (NEW)
6. **Legacy fixture (I-002): accepts the canonical legacy fixture from disk** (NEW)

## Files Modified

| Path | Change |
|---|---|
| `server/middleware/schemas.js` | Added `.default(0)` / `.default(100)` on x, y, width, height |

## Next

Proceed to Phase 3: Fix I-005 atomic storage writes (`server/services/storage.js`).
