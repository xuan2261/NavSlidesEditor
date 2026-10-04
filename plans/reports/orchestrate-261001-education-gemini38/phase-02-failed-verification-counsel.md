## TL;DR

**The reported failure belongs to an incidental source-layout test, not a demonstrated alignment regression. Delete that test; do not repoint its regex at the extracted module.** This authorizes continued repair—not a GREEN claim or Phase02 gate bypass.

Installed `kongming.md` loaded. Read-only inspection only; no edits, checks, delegation, or model switching.

## Owning boundary

The failing suite in `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx:211–264`:

- Reads raw source rather than rendering either control.
- Requires literal `aria-label` JSX followed by a named icon with `size={14}` (`:233–239`).
- Compares captured identifier strings—not React component identity.

The extraction invalidates that source-location assumption:

- Format now renders `HorizontalAlignmentControls` at `ribbon-format-tab-element-position-size-rotation-controls.jsx:348–350`.
- The child uses an `ALIGNMENTS` table and `<Icon size={14} />` at `ribbon-horizontal-alignment-controls.jsx:8–11,30–36`.
- Its left/center/right imports are still `AlignStartVertical`, `AlignHorizontalJustifyCenter`, and `AlignEndVertical`. Arrange uses the same named imports in `controls/arrange-controls.jsx:19–22`.

Thus, `formatLeft === undefined` is explained by inspecting the wrong implementation location and requiring inline JSX. **No icon mismatch is evidenced.** Even pointing the regex at the child would retain an implementation-layout test and encounter dynamic labels/icons.

The developer rule explicitly requires deleting source-text/incidental-implementation tests, never re-pinning them. Remove the entire `icon consistency pass — align identity` block; retain the behavioral suite.

## Behavioral evidence and limits

`editor-controls-behavior.test.jsx:44–60` renders Format, invokes the real alignment hook, and asserts resulting geometry:

- Left: `[100,100,100]`
- Center: `[200,250,260]`
- Right: `[300,400,420]`
- Numeric X=0 preserves relative separation: `[-150,150,0]`

The supplied run reports these tests passed. This supports the bounds-versus-numeric-delta distinction; it does **not** prove browser interaction, persistence, history, or single rotated alignment.

## Single rotated alignment qualification

The current child calculates a visual-AABB translation, then rounds stored X (`ribbon-horizontal-alignment-controls.jsx:22–25`).

**[INFERENCE—mathematical consequence]** For finite valid geometry, rounding can leave the intended visual edge or center up to **0.5 slide-coordinate pixels** from its target, plus floating-point error. This applies to rotated edges and fractional center positions. It is not mathematically exact edge alignment.

Phase02 requires single-element slide-edge/center behavior at the actual resolution and rotated/off-canvas coverage (`phase-02-editor-controls.md:33,42,102`), but the inspected contract specifies no numeric tolerance. Therefore:

- Do not silently describe rounded alignment as exact.
- Qualify the single rotated path through actual resulting AABB/state.
- If exact placement is the required interpretation, the unconditional rounding is a separate behavioral boundary to repair—not grounds for retaining the icon test.
- Do not change precision merely to resolve this failure.

## Concrete next step

1. Delete only the incidental icon-identity suite.
2. After that edit, rerun the **exact supplied seven-file command**, without filters, skips, or reduced scope.
3. Record the original failure and its source-layout ownership alongside the post-edit result.
4. Continue the required single-resolution/rotated/off-canvas and actual-browser verification. Keep Phase02 acceptance closed until its existing criteria are satisfied.

**Avoid:** modifying production JSX to satisfy the regex, relocating the source assertion, or replacing it with another icon-name identity assertion.

**Confidence:** High for failure ownership. Single rotated precision remains unverified at runtime; no checks were run in this counsel.