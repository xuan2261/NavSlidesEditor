## Diagnosis

**The source contains an explicit below-768px editor exclusion. This is the leading explanation for the invisible shape—not sidebar crowding or an unsupported selector.** Runtime attribution remains **[INFERENCE]** until the requested DOM receipt.

Evidence:

- `client/src/components/editor/editor-shell.jsx:16,26`: both shell branches use `hidden … md:flex`. The active `children` branch hides the entire editor below `md`, while retaining its descendants in the DOM.
- `client/src/pages/EditorPage.jsx:690-708`: supplies a separate `md:hidden` guard reading **“Tablet or desktop required”** and directing users to a wider workspace.
- `client/tailwind.config.js`: does not override Tailwind’s default screen breakpoints; `md` is 768px.
- Consequently, a mounted shape wrapper beneath a `display:none` shell is consistent with the reported Playwright visibility timeout.

**The existing responsive rails cannot bypass that ancestor.** `EditorPage.jsx:682-687` already derives:
- `<1024`: neither rail docked; existing navigator/inspector overlays.
- `1024–1279`: navigator docked; inspector overlay.
- `≥1280`: requested rails docked.

The actual page derives these values directly. The separate `responsive-editor-workspace-context.jsx` is not the responsive state source for this callsite.

Persisted zoom is secondary: `SlideCanvas.jsx:243-256` clamps auto-fit to at least `0.1`. A positive scale cannot make descendants of `display:none` visible. Also, `hidden:true` elements are filtered out of canvas rendering; the reported wrapper’s presence weighs against that particular explanation. It does not independently establish the active slide identity.

## Next discriminating receipt—not another failed click

Before any shape action, the next authorized browser run should capture:

1. **Viewport screenshot**, including the guard and status bar.
2. **Viewport mode:** `innerWidth/innerHeight`, `visualViewport` dimensions/scale, `devicePixelRatio`, and matches for `(min-width:768px)` and `(pointer:coarse)`.
3. **Ancestor chain from `slide-element-audit-shape` upward:** classes, computed `display`, `visibility`, `contentVisibility`, `transform`, `overflow`, `inert`, client dimensions, `getClientRects().length`, and bounding rectangle.
4. **Root/workspace/canvas receipts:** `#root`, main layout, shell, `[data-workspace-tier]`, canvas container, and `[data-testid="canvas-area"]`; guard display/rectangle; navigator/inspector presence.
5. **Active slide identity and zoom mode**, obtained through the existing harness rather than assuming the initial route selected slide 1.

Interpretation:

| Receipt | Diagnosis |
|---|---|
| Shell `display:none`; guard displayed; descendants have no client rects | Explicit breakpoint exclusion confirmed |
| Shell visible; workspace/container has zero dimensions | Root/flex sizing issue |
| Shell/container visible and positive-sized; canvas clipped or displaced | Scale/layout issue |
| Geometry valid; target belongs to unexpected active slide | Navigation/state issue |
| Geometry valid; overlay/inert or hit-test obstruction | Interaction obstruction |

Save receipts **before** assertions. Enclose context use in `try/finally { await browser.close() }`; an external deadline is not cleanup.

## Bounded repair/design

**There is no usable below-768px editor route in this source. Keeping the 320 acceptance requires changing that restriction, not merely changing the smoke selector.**

After confirming the hidden ancestor:

- Remove the shell’s below-`md` exclusion and the contradictory guard contract.
- Reuse the existing compact workspace, overlay launchers, inspector and Selection Pane. No new mobile UI subsystem.
- Existing path: **Inspector → Selection Pane → select shape → shape controls**. `PropertiesPanel.jsx:126-135` routes selection through the existing controller; `SelectionPane.jsx` supports click and Enter/Space. Direct canvas selection should remain usable when overlays are closed.
- Preserve intentional canvas `inert` while an overlay is open (`editor-canvas-workspace.jsx`). Close the overlay before exercising the canvas.

Removing the guard alone is **not** proof of mobile acceptance. Concrete risks:
- Header combines a nonshrinking 120px title field with other controls inside `overflow-hidden` (`editor-header.jsx`); important actions may be clipped at 320.
- Inspector is 240px wide; verify scrolling and actual control rectangles.
- Selection rows do not use `ui-coarse-target`; touch targetability needs measurement.
- Verify keyboard entry, Escape dismissal and focus return through the existing overlay path.

**320 remains failed; this run produced no successful 768/desktop receipts. No Phase02 approval.** Counsel was source-only: no edits, execution, browser use, delegation or model switching.