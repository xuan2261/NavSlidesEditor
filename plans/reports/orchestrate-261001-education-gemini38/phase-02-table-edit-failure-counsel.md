## Decision

**Proceed with the admission fix, but not helper-only.** The supplied browser failure and inspected source agree: canvas double-click accepts tables; `getElementForActiveSlideEdit` rejects them before `TableRenderer` receives editing state.

No edits, checks, browser runs, delegation, or model switch performed.

## Required correction

1. **`client/src/pages/editor-page-helpers.js:1–4`**  
   Admit exactly `text` and `table`. Preserve active-slide precedence: an active child must not fall back to its parent merely because the ID is absent.

   References found: `EditorPage.jsx` import, re-export, controller argument, and the active-child characterization test. No other helper references found in searched `client`, `shared`, and `tests`.

2. **`client/src/hooks/editor-controller/use-editor-rich-text-controller.js` — `startEditingElement`**  
   Preserve lock checks, selection, `editingElementId`, and its synchronous ref assignment. Then return for nontext elements **before** TipTap `setContent` and focus scheduling. Table editing must work independently of TipTap availability.

3. **Same file — `onUpdate`**  
   Gate the actual mutation using the element resolved inside the current presentation updater: matching ID **and `element.type === 'text'`**. Admission now permits tables, so the helper alone is no longer a text-type guard. Temporary `settingContent` suppression does not protect later stale TipTap updates.

## Risks

- **Pending focus callback:** a previously started text edit schedules focus after 10 ms. The table early return does not cancel that callback. Revalidate the editing target before delayed focus, or cancel the pending callback when the target changes; otherwise it can steal table focus.
- **Keyboard scope:** inspected canvas keyboard handling does not start editing on Enter. Do not claim the admission fix repairs Enter entry. The required acceptance path is double-click → textarea; Enter **inside** that textarea must insert a newline.
- **Existing browser coverage misses this path:** `tests/e2e/elements/table-element-interactions-row-col-add-and-cell-edit-and-styling.spec.js` edits through the properties panel, not canvas textareas.
- **No renderer rewrite needed for admission:** `TableRenderer` already stores textarea values in `data`, stops key propagation, and renders static cells with `whiteSpace: 'pre-wrap'`. Generated table HTML already specifies `white-space:pre-wrap` in `shared/src/element-renderers.js:717`.

## Exact regression scope

Extend the existing table interaction suite with a real consumer path:

1. Seed equivalent slide-3 table content; double-click a **specific nonfirst cell**.
2. Assert that cell’s textarea is visible **and focused**.
3. Type two distinct lines using a real Enter keypress—not merely `fill()` with `\n`.
4. Observe saved API data with the exact multiline value; reload and verify it remains.
5. Open actual generated Present output and print media. Assert the targeted cell’s exact newline-bearing text and whitespace behavior; inspect rendered line separation, not only serialized HTML.
6. Cover text → table → text transitions: table data remains intact, stale TipTap updates do not add/overwrite table `content`, and ordinary text editing still saves.
7. Preserve behavioral coverage for locked tables, locked slides, unsupported element types, and active-child targeting.

**Acceptance:** the supplied failure remains the baseline; the later implementation must demonstrate canvas multiline authoring through persistence and generated output. Prior print/unit passes do not establish this table path.