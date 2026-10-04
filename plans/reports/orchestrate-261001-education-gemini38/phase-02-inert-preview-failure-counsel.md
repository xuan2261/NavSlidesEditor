## Disposition
**Incorrect smoke expectation; no renderer change warranted.** Phase02’s game row covers selection geometry/style and nested configuration; complete authoring/runtime belongs to phases03/05 (`phase-02-editor-controls.md:89`). Its smoke explicitly requires reporting existing game interaction limitations (`:134-136`).

The active canvas registry uses `game-element-renderer.jsx`. In edit mode, name-picker dispatches to `NamePickerRenderer`; its button branch renders an icon and choice-count summary, **not participant names** (`game-renderers/name-picker.jsx:109-136`). The reported output matches that implementation. Choice count alone does not prove item contents.

## Correct proof
For this Phase02 picker case:
- After reload, select the same game and verify the **actual Name picker controls** recover Ada and Grace, in order, and mode `button`.
- Verify saved/API JSON preserves the corresponding subtype configuration, plus the audited geometry/style.
- Observe the canvas’s button-mode visual and geometry/style; do not require `Ada` in the inert wrapper.

Generated game rendering uses a static fallback (`shared/src/element-renderers.js:940-982`). Record its actual output and limitations; do not claim name selection, animation, or participant-name rendering.

## Remaining-field evidence
**Yes: saved JSON plus real generated Present/Share/normal portable-file receipts is the appropriate proof combination**, provided it follows actual control authoring and save/reload—not substituted JSON injection.

Use field-specific consumer evidence: rendered geometry/styles, code language and walkthrough state, rendered equation, HTML frame content, Markdown structure, SVG paths/arrows, actual chart values, media source/control state and playback, and QR decoding to the authored payload. JSON alone cannot prove rendering; DOM text alone cannot prove media playback or QR correctness. Do not replace the failed assertion with copied-count or source-text assertions.

## Gate
Read-only counsel only; no edits, checks, browser activity, delegation, or model switching performed. The supplied portable result remains **two failures, then PASS**, not a third portable failure. This independent manual assertion failure does not authorize phase approval. Correct the proof expectation in the execution session, finish remaining receipts, then update docs/changelog after successful smoke.