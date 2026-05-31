# Design Decision Report: Insert Ribbon UX Refinement

Date: 2026-05-18

## Problem

`Media`, `Embed`, `Advanced` were grouped to solve ribbon overflow. Layout passed, but UX regressed: common Insert actions now require extra clicks and cramped dropdowns.

## Options

### Option A: Keep dropdowns, enlarge menus

Pros:
- Smallest code/test change.
- Keeps 1280px layout likely green.

Cons:
- Does not fix click depth for common Media/Embed actions.
- Still hides primary insertion actions.

Verdict: Reject. Treats symptom.

### Option B: Media/Embed direct, Advanced flyout

Pros:
- Common Insert actions become 1 click.
- Advanced remains grouped because low-frequency and many items.
- Fits current mental model: section labels remain `Media`, `Embed`, `Advanced`.

Cons:
- Width budget risk at 1280px.
- Test helpers need update.

Verdict: Recommended.

### Option C: All actions direct

Pros:
- Fastest access.

Cons:
- Likely reintroduces overflow.
- Too dense, poor scanability.

Verdict: Reject for now.

## Final Design

- `Media` section: direct icon-only buttons.
- `Embed` section: direct icon-only buttons.
- `Advanced` section: one trigger opens wider 2-column flyout/palette.
- Use `title` + `aria-label` for every icon-only button.
- Use shared `handleKeyboardActivation` pattern for Enter/Space.
- Do not add responsive JS or complex CSS breakpoints.
- Keep smaller viewport behavior simple: no clip/overlap; horizontal scroll acceptable below 1280.

## Risks

- 1280 width overflow returns. Mitigation: TDD layout budget first; reduce section padding/gaps before retreating to dropdowns.
- File Browser conditional makes layout pass locally but fail in contexts with file browser. Mitigation: test both 3-item and 4-item Media cases if feasible; otherwise assert existing EditorPage context that wires File Browser.
- Menu nesting (`Advanced -> Games...`) remains awkward. Mitigation: wider flyout and preserve current game gallery behavior.

## Unresolved Questions

- None.

