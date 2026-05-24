---
title: "Local Evidence - Editor Rich Text Formatting"
date: 2026-05-23
status: local-pass-upstream-blocked
phase: 2
rowId: editor-rich-text-formatting
---

# Local Evidence - Editor Rich Text Formatting

## Scope Guard

This report is local regression evidence for the current repo only. It is not
upstream oracle evidence, does not prove upstream parity, and does not make the
matrix row release-ready.

The row remains `Blocked` until approved upstream automation passes, complete
manual oracle evidence is attached, or a signed row-level waiver is approved.

## Row

| Field | Value |
|---|---|
| Row id | `editor-rich-text-formatting` |
| Tier | `MVP P0` |
| Security invariant | `no` |
| Behavior contract | Apply rich text marks/styles; visible formatting and persisted TipTap/HTML state remain correct |
| Matrix path | `docs/upstream-parity-matrix.md` |

## Command

```powershell
npx playwright test tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js
```

## Result

| Field | Value |
|---|---|
| Exit code | `0` |
| Test file | `tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js` |
| Tests | `6 passed` |
| Duration | `20.1s` |

## Covered Local Behaviors

- Seeded rich text with `strong` and `em` renders visibly.
- Insert tab can add a text element and persist its element type.
- `Control+b` persists bold markup while editing.
- `Control+i` persists italic markup while editing.
- Font family changes persist through the property panel.
- Text alignment changes persist through the property panel.

## Limitations

- No approved upstream runtime evidence was captured.
- No screenshot, video, or exported artifact from the approved upstream SHA is
  attached.
- Underline, remove mark, mixed mark removal, and export rendering are not fully
  covered by this local slice.
- This result cannot be used as `Pass` evidence for upstream parity.

## Follow-Up Required

- Capture manual oracle evidence for `editor-rich-text-formatting`, or recover
  upstream automation for the approved SHA.
- Add or identify local evidence for underline, mark removal, and export
  rendering before considering this row fully covered.
- Assign a reviewer for manual oracle evidence signoff.
