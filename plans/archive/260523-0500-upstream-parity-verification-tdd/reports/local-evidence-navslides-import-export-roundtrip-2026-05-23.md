---
title: "Local Evidence - Navslides Import Export Roundtrip"
date: 2026-05-23
status: local-pass-upstream-blocked
phase: 2
rowId: navslides-import-export-roundtrip
---

# Local Evidence - Navslides Import Export Roundtrip

## Scope Guard

This report is local regression evidence for the current repo only. It is not
upstream oracle evidence, does not prove upstream parity, and does not make the
matrix row release-ready.

The row remains `Blocked` until approved upstream automation passes, complete
manual oracle evidence is attached, or a signed row-level waiver is approved.

## Row

| Field | Value |
|---|---|
| Row id | `navslides-import-export-roundtrip` |
| Tier | `MVP P0` |
| Security invariant | `no` |
| Behavior contract | Export `.navslides`, import it back, and preserve manifest/media references plus editable slide state |
| Matrix path | `docs/upstream-parity-matrix.md` |

## Commands

```powershell
npx playwright test tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js
npm test -- client/src/utils/export-project.test.js client/src/utils/import-project.test.js
```

## Results

| Command | Exit code | Result | Duration |
|---|---:|---|---:|
| `npx playwright test tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js` | `0` | `4 passed` | `16.6s` |
| `npm test -- client/src/utils/export-project.test.js client/src/utils/import-project.test.js` | `0` | `14 passed` | `3.18s` |

## Covered Local Behaviors

- Client download flow exports `.navslides` JSON archive when no local media is
  present.
- Offline HTML, HTML menu export, and PDF print export paths remain covered by
  the same archive/download e2e slice.
- `exportProject` unit coverage remains green.
- `validateProjectFile` and media URL rewrite import utilities remain green.

## Limitations

- No approved upstream runtime evidence was captured.
- No retained `.navslides` artifact from the approved upstream SHA is attached.
- The e2e slice covers no-local-media archive export; full media-bearing archive
  import/export roundtrip remains a follow-up gap.
- Duplicate names, corrupt archives, and version mismatch edge cases are covered
  only to the extent present in the current utility tests.
- This result cannot be used as `Pass` evidence for upstream parity.

## Follow-Up Required

- Capture manual oracle evidence for `navslides-import-export-roundtrip`, or
  recover upstream automation for the approved SHA.
- Retain representative `.navslides` artifacts if this row is promoted toward
  release evidence.
- Add or identify full media-bearing import/export roundtrip coverage before
  considering this row fully covered.
- Assign a reviewer for manual oracle evidence signoff.
