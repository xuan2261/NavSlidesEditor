---
phase: 6
title: "Backend contract hardening pass"
status: pending
priority: P2
dependencies: [2]
---

# Phase 06: Backend contract hardening pass

## Overview

Tighten and verify backend template contracts after frontend normalization. Some safeguards may already exist from prior fixes; this phase should confirm coverage first, then add only missing hardening.

## Requirements

- Functional: Existing endpoints remain backward compatible.
- Non-functional: Invalid input returns 400 where schemas apply, not 500. Built-in templates stay normalized in read paths.

## Architecture

Keep backend changes local to current route/service patterns:

- `server/routes/marketplace.js`
- `server/services/template-normalization.js`
- `server/routes/templates.js`
- `server/routes/presentations.js`
- `server/middleware/schemas.js`

Do not introduce database or new persistence format.

## Related Code Files

- Modify: `server/services/template-normalization.js`
- Modify: `server/routes/marketplace.js`
- Modify: `server/routes/marketplace.test.js`
- Modify: `server/routes/templates.test.js`
- Modify: `server/routes/presentations.test.js`
- Modify: `server/middleware/schemas.js`

## TDD Steps

1. Confirm or add schema tests for marketplace built-in normalization:
   - string background becomes `{ type: 'color', color }`
   - missing element `id` gets stable fallback
   - missing `zIndex` gets numeric fallback
2. Confirm or add tests for query handling:
   - repeated tags
   - empty tags
   - mixed comma + repeated tags
3. Confirm or add tests for template validation:
   - missing title
   - empty slides
   - invalid element type
   - too-long title
4. Add save-as-template validation tests if not already present.

## Implementation Steps

1. Expand `template-normalization.js` with metadata normalization only if backend needs it.
2. Keep `loadBuiltInTemplates()` cache behavior unchanged unless tests prove cache staleness is a real issue.
3. Ensure route catches return meaningful status codes.
4. Avoid changing public response fields, only fill safe defaults.

## Success Criteria

- [ ] Backend routes return stable normalized data.
- [ ] Invalid template payloads fail predictably with 400.
- [ ] Query parsing cannot throw for common Express query shapes.
- [ ] Focused tests pass:

```powershell
npx vitest run server/routes/marketplace.test.js server/routes/templates.test.js server/routes/presentations.test.js
```

## Risk Assessment

Risk: stricter validation rejects old saved user templates.  
Mitigation: apply strict schemas only to create/update inputs, keep read paths tolerant.
