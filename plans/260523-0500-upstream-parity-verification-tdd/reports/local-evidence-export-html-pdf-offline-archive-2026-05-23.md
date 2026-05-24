---
title: "Local Evidence - Export HTML PDF Offline Archive"
date: 2026-05-23
status: local-pass-upstream-blocked
phase: 2
rowId: export-html-pdf-offline-archive
---

# Local Evidence - Export HTML PDF Offline Archive

## Scope Guard

This report is local regression evidence for the current repo only. It is not
upstream oracle evidence, does not prove upstream parity, and does not make the
matrix row release-ready.

The row remains `Blocked` until approved upstream automation passes, complete
manual oracle evidence is attached, or a signed row-level waiver is approved.

## Row

| Field | Value |
|---|---|
| Row id | `export-html-pdf-offline-archive` |
| Tier | `MVP P0` |
| Security invariant | `no` |
| Behavior contract | Export HTML, offline HTML, PDF print HTML, and project archive artifacts with expected content/assets |
| Matrix path | `docs/upstream-parity-matrix.md` |

## Commands

```powershell
npx playwright test tests/e2e/export/html-export-and-present-endpoints-with-content-validation.spec.js tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js
npm test -- client/src/utils/offlineExport.test.js client/src/utils/export-project.test.js
```

## Results

| Command | Exit code | Result | Duration |
|---|---:|---|---:|
| `npx playwright test tests/e2e/export/html-export-and-present-endpoints-with-content-validation.spec.js tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js` | `0` | `11 passed` | `14.2s` |
| `npm test -- client/src/utils/offlineExport.test.js client/src/utils/export-project.test.js` | `0` | `2 passed` | `3.24s` |

## Covered Local Behaviors

- Export endpoint sets attachment headers and HTML MIME type.
- Export HTML contains expected slide sections and seeded title content.
- Present endpoint serves reveal.js scaffold, preview strips controls, and
  browser render has no console errors.
- Unknown export id is rejected.
- Client download flow exports `.navslides` JSON archive when no local media is
  present.
- Offline HTML export avoids remote CDN scripts.
- Export HTML menu item downloads HTML.
- PDF export menu opens print HTML in a new window.
- Offline/export-project unit contracts remain green.

## Limitations

- No approved upstream runtime evidence was captured.
- No screenshot, video, retained exported artifact, or print/PDF output from the
  approved upstream SHA is attached.
- Missing media, fragments, large deck, and offline local-media edge cases are
  not fully covered by this local slice.
- This result cannot be used as `Pass` evidence for upstream parity.

## Follow-Up Required

- Capture manual oracle evidence for `export-html-pdf-offline-archive`, or
  recover upstream automation for the approved SHA.
- Retain representative export artifacts if this row is promoted toward release
  evidence.
- Assign a reviewer for manual oracle evidence signoff.
