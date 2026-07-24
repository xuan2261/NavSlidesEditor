---
title: "Local Evidence - Editor Undo Redo Clipboard"
date: 2026-05-23
status: local-pass-upstream-blocked
phase: 2
rowId: editor-undo-redo-clipboard
---

# Local Evidence - Editor Undo Redo Clipboard

## Scope Guard

This report is local regression evidence for the current repo only. It is not
upstream oracle evidence, does not prove upstream parity, and does not make the
matrix row release-ready.

The row remains `Blocked` until approved upstream automation passes, complete
manual oracle evidence is attached, or a signed row-level waiver is approved.

## Row

| Field | Value |
|---|---|
| Row id | `editor-undo-redo-clipboard` |
| Tier | `MVP P0` |
| Security invariant | `no` |
| Behavior contract | Copy/cut/paste/duplicate and undo/redo update element state and selection predictably without duplicate IDs or lost content |
| Matrix path | `docs/upstream-parity-matrix.md` |

## Commands

```powershell
npx playwright test tests/e2e/undo-redo.spec.js
npm test -- client/src/hooks/use-clipboard.test.js
```

## Results

| Command | Exit code | Result | Duration |
|---|---:|---|---:|
| `npx playwright test tests/e2e/undo-redo.spec.js` | `0` | `4 passed` | `34.6s` |
| `npm test -- client/src/hooks/use-clipboard.test.js` | `0` | `17 passed` | `1.52s` |

## Covered Local Behaviors

- Undo removes a newly added element.
- Redo restores an element after undo.
- Undo/redo keyboard shortcuts work.
- Bounded stress path covers repeated add, undo, and redo.
- Clipboard helpers strip copied/cut IDs.
- Paste operations generate new IDs and offset pasted elements.
- Duplicate and cut operations handle missing, locked, and empty selections.

## Limitations

- No approved upstream runtime evidence was captured.
- No screenshot, video, or exported artifact from the approved upstream SHA is
  attached.
- Grouped-element clipboard behavior and paste-after-reload are not fully
  covered by this local slice.
- This result cannot be used as `Pass` evidence for upstream parity.

## Follow-Up Required

- Capture manual oracle evidence for `editor-undo-redo-clipboard`, or recover
  upstream automation for the approved SHA.
- Add or identify local coverage for grouped clipboard operations and
  paste-after-reload before considering this row fully covered.
- Assign a reviewer for manual oracle evidence signoff.
