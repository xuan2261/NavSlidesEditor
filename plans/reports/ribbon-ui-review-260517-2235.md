# Ribbon UI Review - EditorPage

Date: 2026-05-17
Scope: EditorPage header, ribbon controls, ribbon tabs, responsive/overflow behavior.
Method: `ck:agent-browser` live browser audit on `http://localhost:5173/editor/ac13936d-fb9c-405b-a8dd-783b6c76226d`; viewport checks at 1280, 1024, 900, 768 px; DOM metrics via `getBoundingClientRect`, `scrollWidth/clientWidth`, overlap scan; screenshots saved in `docs/ui-review/`.

## Key Findings

1. Icon buttons with visible labels are clipped by the shared `Button` icon variant.
   - Files: `client/src/components/ui/Button.jsx`, `client/src/components/ribbon/ribbon-file-dropdown-menu.jsx`, `client/src/components/ribbon/ribbon-header-bar.jsx`, `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`.
   - Cause: `variant="icon"` always applies `w-8 h-8 !p-0`, so call-site classes like `h-7 px-2 flex items-center gap-1` cannot widen the button.
   - Affected labels: `File`, `Share`, `Text`, `Shape`, `Games`; measured examples: `Share` 32px client width vs 40px scroll width; `Text` 32px vs 36px; `Shape` 32px vs 42px; `Games` 32px vs 43px.
   - Impact: clipped text, cramped icon/text controls, inconsistent button widths.

2. Ribbon content overflows horizontally inside the center editor area.
   - File: `client/src/components/ribbon/ribbon-panel.jsx`.
   - Cause: center ribbon width is constrained by fixed side panels; tab contents are single-row `shrink-0` sections with nested `overflow-x-auto`.
   - At 1280px, Insert content scrollWidth is 1021px inside 840px visible width. Interactive/Games controls are outside visible ribbon.
   - At 1024px, Home hides Arrange controls; Insert hides Media/Embed/Interactive/Games; View hides Window controls.
   - At 768px, Home has 11 controls outside visible ribbon; Insert has 20; Design has 8; View has 6.
   - Impact: controls look missing/cut off unless user horizontally scrolls a low-height ribbon strip.

3. Text-editing Home ribbon is much wider than normal Home ribbon.
   - File: `client/src/components/ribbon/home-tab-content.jsx`.
   - When TipTap editor is active, Font + Paragraph controls expand the row heavily.
   - At 1280px, measured controls extend to x=1489 while visible ribbon ends at x=1040; line-height, clear-formatting, canvas, zoom, arrange controls are off-screen.
   - Impact: most right-side controls unavailable without horizontal scroll while editing text.

4. Vertical alignment is inconsistent across Format controls.
   - File: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`.
   - Measured at 1280px: number inputs are 20px high at y=74, buttons are 32px high at y=68, opacity slider is 4px high at y=82.
   - Impact: section rows look uneven even without actual geometric overlap.

5. Header tab list also scrolls under medium/narrow widths.
   - Files: `client/src/pages/EditorPage.jsx`, `client/src/components/ribbon/tab-bar-with-scroll-and-icons.jsx`.
   - At 1024px, tablist visible width is 434px while scrollWidth is 611px; `View` is outside the visible tablist. At 768px, `Format`, `Transitions`, `Animations`, `View` are outside.
   - This is not DOM overlap, but UX feels like controls are squeezed because the fixed title input + quick access + right actions leave little room.

## Evidence

Screenshots captured:
- `docs/ui-review/ribbon-review-1366-home.png`
- `docs/ui-review/ribbon-review-1366-insert.png`
- `docs/ui-review/ribbon-review-1366-design.png`
- `docs/ui-review/ribbon-review-1366-transitions.png`
- `docs/ui-review/ribbon-review-1366-animations.png`
- `docs/ui-review/ribbon-review-1366-view.png`
- `docs/ui-review/ribbon-review-1280-home-text-editing.png`
- `docs/ui-review/ribbon-review-1280-format-selected-text.png`
- `docs/ui-review/ribbon-review-1024-home.png`
- `docs/ui-review/ribbon-review-1024-insert.png`
- `docs/ui-review/ribbon-review-1024-design.png`
- `docs/ui-review/ribbon-review-1024-view.png`
- `docs/ui-review/ribbon-review-900-home.png`
- `docs/ui-review/ribbon-review-900-insert.png`
- `docs/ui-review/ribbon-review-900-design.png`
- `docs/ui-review/ribbon-review-900-view.png`
- `docs/ui-review/ribbon-review-768-home.png`
- `docs/ui-review/ribbon-review-768-insert.png`
- `docs/ui-review/ribbon-review-768-design.png`
- `docs/ui-review/ribbon-review-768-view.png`

No direct button-to-button geometric overlap found in the visible ribbon rows. The reported visual issue is mostly clipping, hidden overflow, cramped icon+label buttons, and inconsistent vertical sizing.

## Recommended Fix Direction

1. Split shared button variants:
   - Keep `icon` as strict 32x32 icon-only.
   - Add a `toolbar` or `ribbon` variant for icon+text controls with `h-8 px-2 w-auto min-w-8`.
   - Update File/AI/Share/Text/Shape/Games to use the new variant or remove visible text from icon-only buttons.

2. Normalize ribbon control dimensions:
   - Standardize button/select/input height to 28 or 32px inside ribbon.
   - Add a small wrapper for Format numeric controls so inputs, icon buttons, and sliders share a consistent center line.

3. Improve overflow behavior:
   - Prefer section compaction per breakpoint before relying on horizontal scroll.
   - For Insert, group low-frequency controls into dropdowns: Media, Embed, Interactive, Games.
   - For text-editing Home, move advanced typography/paragraph controls into compact dropdowns or secondary row.

4. Reduce header pressure:
   - Make presentation title width responsive below 1024px.
   - Keep File/AI/Share icon-only at narrow widths with reliable tooltip/aria-label.
   - Consider prioritizing tab labels: icons-only below a threshold, or a More menu for hidden tabs.

## Unresolved Questions

- Should ribbon be single-row PowerPoint-like with horizontal scroll, or should it wrap/compact into dropdown groups at smaller widths?
- Should File/AI/Share display text labels on desktop, or be icon-only consistently?
