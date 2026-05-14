# 260514-0908 Upstream Selective Port

## Summary

- Replaced unsafe unrelated-history sync with selective port workflow.
- Kept only Copy URL context menu feature from upstream candidate set.
- Deferred typography expansion, HTML embed migration, timeline, and citation domains because local behavior/schema did not need or fit those changes.

## Implementation

- Sync branch: `sync/upstream-selective-port-20260514`
- Topic commit before merge: `74839661 feat(editor): add copy url context menu action`
- Master merge commit: `3907f049 merge: selective upstream copy url port`
- Changed files:
  - `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`
  - `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx`
  - `vitest.config.mjs`

## Validation

- `npm run lint` passed.
- `npm run build` passed.
- `npm run test` passed on `master`: 105 files, 922 tests.
- Targeted Playwright sweep passed: 31 tests.

## Notes

- One full unit run hit the known shared `server/data` route flake; final fix disables Vitest file-level parallelism so storage-backed route suites no longer race.
- Push not performed; requires explicit user approval.

## Unresolved Questions

- Whether LaTeX font size/color controls should be planned separately.
- Whether timeline or image citation schema should be added to future roadmap.
