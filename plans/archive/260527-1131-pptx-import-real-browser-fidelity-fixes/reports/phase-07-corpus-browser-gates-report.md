# Phase 07 Corpus Browser Gates Report

Date: 2026-05-27

## Summary

Phase 07 is complete.

## Gate Commands

- PR smoke strict: `npm run test:pptx:browser-audit`
- Release full strict: `npm run test:pptx:browser-audit:full`
- Combined semantic + browser strict: `npm run test:pptx:strict`
- Manual headed full strict: `npm run test:pptx:browser-audit:headed`

## Changes

- Added cross-platform runner: `scripts/run-pptx-browser-audit.js`.
- Added audit scope selection: `PPTX_IMPORT_AUDIT_SCOPE=smoke|full` and `PPTX_IMPORT_AUDIT_DECKS`.
- Added strict summary validation through `assertStrictAuditSummary`.
- Kept sanitized diagnostics and ignored artifact paths.

## Validation

- `npx vitest run tests/unit/pptx-import-audit-helper.test.js` passed: 10 tests.
- `npm run test:pptx:browser-audit` passed: 3 Playwright tests.
- `npm run test:corpus` passed: 11 files, 11 passed, 0 failed.
- `npm run test:pptx:browser-audit:full` passed: 6 Playwright tests.

Full strict artifact:

- `plans/reports/pptx-import-real-browser-audit-runs/2026-05-27T09-25-02-029Z-19104/pptx-import-real-browser-audit.json`

## Unresolved Questions

None.
