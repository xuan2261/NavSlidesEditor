---
phase: 1
title: "Schema and Canonical Element Type Contract"
status: completed
priority: P0
dependencies: []
---

# Phase 01: Schema and Canonical Element Type Contract

## Overview

Make `ELEMENT_DEFAULTS` the executable canonical element list and force shared JSDoc/schema declarations to mirror it.

## Requirements

- Functional: `shared/src/types/presentation.js` must list all 19 canonical element types and remove stale `qr`/`divider` type claims.
- Functional: `SlideElement` union must include all concrete element typedefs or explicitly document generic fallback for less-modeled types.
- Functional: high-risk stale property names in JSDoc must be fixed or listed as accepted debt with follow-up coverage.
- Non-functional: new tests must fail when `ELEMENT_DEFAULTS` changes without schema mirror updates.

## Architecture

Keep `ELEMENT_DEFAULTS` as runtime canonical source. Add a test that parses or imports canonical keys, then checks the shared JSDoc string/type declarations for exact membership. Prefer a small parser helper in test code instead of introducing runtime coupling from `shared` back to `client`.

## Related Code Files

- Modify: `shared/src/types/presentation.js`
- Modify: `client/src/data/element-defaults.test.js`
- Optional create: `shared/src/types/presentation.test.js` or `client/src/data/element-schema-drift.test.js`

## TDD Steps

1. Add failing drift test asserting shared `ElementType` equals `Object.keys(ELEMENT_DEFAULTS)`.
2. Add failing assertions for stale types: `qr` and `divider` must not be present.
3. Add failing assertions that `qrcode`, `timeline`, and `game` are present.
4. Add a minimal stale-property drift test for known mismatches: `shapeType` vs `shape`, `code`/`latex`/`htmlContent`/`markdown` vs `content`, and `color` vs `iconColor`.
5. Update JSDoc typedefs and `SlideElement` union.
6. Run targeted tests until green.

## Targeted Tests

```powershell
npx vitest run client/src/data/element-defaults.test.js
npx vitest run shared/src/types/presentation.test.js
```

If the second test file is not created, replace with the actual new drift-test path.

## Success Criteria

- [x] Canonical element count remains 19.
- [x] Shared JSDoc `ElementType` exactly matches canonical keys.
- [x] No stale `qr`/`divider` type aliases remain unless intentionally marked legacy outside the canonical union.
- [x] High-risk stale property names are corrected or explicitly tracked as accepted debt.
- [x] Tests fail if a new element type is added without schema update.

## Risk Assessment

Risk: tests parse comments and become brittle. Mitigation: keep parser narrow, only validate the `@typedef {...} ElementType` block, and avoid enforcing unrelated comment formatting.
