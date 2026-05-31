---
phase: 2
title: "Fix I-002 Zod Backwards-Compat"
status: pending
priority: P0
effort: "2-3h"
dependencies: [1]
---

# Phase 2: Fix I-002 — Zod Backwards-Compat (GREEN + REFACTOR)

## Overview

Make element geometry fields (`x`, `y`, `width`, `height`) tolerate legacy fixtures that omit them. Without this fix, every deck created before geometry-required validation breaks on save with a 400.

## Severity & Scope

- **Severity:** Medium (data corruption vector — legacy decks unsavable)
- **Affects:** every `POST /api/presentations`, `PUT /api/presentations/:id`, `POST /api/presentations/:id/duplicate`, PPTX import, share-link rendering pipelines that re-emit the schema
- **Root cause:** `server/middleware/schemas.js:33-43` — `elementSchema` requires geometry fields with no defaults

## Requirements

### Functional
- Element without `x`, `y`, `width`, `height` accepted by all mutation endpoints.
- Default geometry values: `x=0`, `y=0`, `width=100`, `height=100` (visible, non-zero, on-canvas).
- Saved data after normalization always includes geometry fields (no `undefined` in storage).
- Existing tests continue to pass — schema becomes *more* permissive, never less.

### Non-functional
- One change site (the schema). No duplicated normalization logic.
- No new runtime dependency.
- Phase 1's I-002 RED test (legacy fixture save) flips to GREEN with this change alone.

## Architecture

```
Before:
  request.body.slides[].elements[]: { type, ...maybeNoGeometry }
    -> updatePresentationSchema parses
    -> Zod: "x is Required" → 400

After:
  request.body.slides[].elements[]: { type, ...maybeNoGeometry }
    -> updatePresentationSchema parses
    -> Zod applies defaults: x=0, y=0, w=100, h=100
    -> persisted record has full geometry
```

Single edit point. No new files. No migration script needed — defaults apply at parse time on every save.

## Related Code Files

- Modify: `server/middleware/schemas.js` (lines 33-43, `elementSchema`)
- Read for context: `server/routes/presentations.js` (where schema is consumed), `server/routes/presentations.test.js` (test harness from Phase 1)
- Tests verifying this fix: `server/routes/presentations.test.js` (the legacy-fixture `it` block from Phase 1.1)

## Implementation Steps

### Step 2.1 — Apply schema defaults

Edit `server/middleware/schemas.js`, replace the `elementSchema` block:

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

Note: `width` / `height` keep `.positive()` so zero/negative still rejects (real bug, not legacy data). Defaults only fill *missing* fields, not invalid ones.

### Step 2.2 — Run Phase 1 RED test → GREEN

```powershell
npx vitest run server/routes/presentations.test.js --grep "Legacy fixture"
```

Expected: test passes. Capture green output to `reports/phase-02-green-evidence.md`.

### Step 2.3 — Run full presentations.test.js to confirm no regression

```powershell
npx vitest run server/routes/presentations.test.js
```

Expected: all original cases still pass (they all supply geometry explicitly, so behavior unchanged).

### Step 2.4 — Verify other entry paths

Manual probe via REST (server running on 3002):

```powershell
# PUT with element missing geometry
curl -X PUT "http://localhost:3002/api/presentations/<existing-id>" `
  -H "Content-Type: application/json" `
  -d '{ "title":"Legacy", "slides":[{ "elements":[{ "type":"text", "content":"<p>hi</p>" }] }] }'
# Expect 200 + saved record geometry x=0,y=0,w=100,h=100
```

```powershell
# Duplicate path should not require geometry round-trip
curl -X POST "http://localhost:3002/api/presentations/<existing-id>/duplicate"
# Expect 201
```

### Step 2.5 — Commit

```text
fix(server): default element geometry to (0,0,100,100) when missing (I-002)

Legacy decks pre-dating geometry validation could not be saved. Schema
now defaults x/y to 0 and width/height to 100. Positive-width invariant
preserved.
```

## Success Criteria

- [ ] `elementSchema` x/y default to 0; width/height default to 100 (`.positive().default(100)`)
- [ ] Phase 1.1 RED test passes
- [ ] Full `server/routes/presentations.test.js` suite passes
- [ ] Manual PUT/duplicate probes succeed
- [ ] No other code file changed in this phase
- [ ] Green evidence captured in `reports/phase-02-green-evidence.md`

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Defaults mask real bugs in frontend that should send geometry | Phase 7 logs a server-side debug warning when defaults are applied (rate-limited to once per minute per element type) — non-blocking observability |
| `width=100` is too small if canvas is large — invisible to user | 100 px on a 1920×1080 canvas is small but visible; user can resize. Alternative `400` was considered but `100` matches the minimum visible threshold and avoids overlapping default text placeholders |
| Storage layer somehow rejects fields with defaults | Storage is JSON dump; no schema enforcement at storage layer. Safe |
| Plugin element types skip the schema | Plugin elements pass `passthrough` and don't require x/y either, but the union allows them; Zod default applies regardless of the type branch |

## Security Considerations

- Schema remains strict on `.positive()` width/height — no zero-size injection.
- `passthrough` was already in place; this change doesn't widen the attack surface.

## Red Team Adjustment

To be populated after `/ck:plan red-team`. Pre-emptive considerations:
- If reviewer asks about default values being too permissive: response is they only apply when the field is missing entirely (Zod default semantics), not when an invalid value is provided.
- If reviewer asks about audit logging: deferred to Phase 7 observability step.

## Next Steps

Phase 7 picks up this fix in the regression sweep and final docs.
