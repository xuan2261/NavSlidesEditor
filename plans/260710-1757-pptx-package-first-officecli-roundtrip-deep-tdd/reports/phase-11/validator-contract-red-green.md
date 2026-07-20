# Phase 11 validator contract evidence

- Date: 2026-07-15
- Scope: fail-closed layered validator return contracts
- Status: partial; G2 remains open

## Red/green log

1. `npx vitest run server/services/pptx-import/transactional-patch.test.js -t "literal true"`
   - Red: `{ ok: false }` from a validator was truthy and accepted as a passing layer.
   - Green: OfficeCLI/native validator layers require literal `true`; test passes.
2. `npx vitest run server/services/pptx-import/transactional-patch.test.js`
   - Green: 21 tests passed.
3. `npx vitest run server/services/pptx-import/officecli server/services/validated-edited-export.test.js server/routes/pptx-import.test.js`
   - Green: 12 files / 93 tests passed after containment, shutdown, and import-cleanup updates.

## Implemented control

- Layered export validation no longer treats arbitrary truthy objects as successful semantic or OfficeCLI validation.

## Open evidence

- Production native re-import remains a ZIP/text postcondition rather than isolated importer/projection comparison.
- Async durable export jobs, lease/predicate revalidation, full fault matrix, real OfficeCLI validation, and protected provider evidence remain open.

## Unresolved questions

- Define and persist structured row/property/source-reference validator results before G2 promotion.
