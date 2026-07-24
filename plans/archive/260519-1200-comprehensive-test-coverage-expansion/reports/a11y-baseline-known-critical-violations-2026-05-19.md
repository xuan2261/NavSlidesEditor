# Accessibility Baseline — Known Critical Violations (2026-05-19)

This file documents the known critical axe-core violations present in the
codebase as of 2026-05-19. Phase 7's a11y gate asserts "no NEW critical
violations beyond this baseline" — fixing the baseline items is tracked
separately as component refactoring work.

## Editor view (`/editor/:id`)

| Rule ID | Impact | Affected element | Recommended fix |
|---------|--------|------------------|-----------------|
| `label` | critical | `<input type="number">` (zoom / dim controls) | Add `aria-label` or wrap with `<label>` |
| `select-name` | critical | `<select>` (font-size, theme dropdown) | Add `aria-label` to native select |

## Home dashboard (`/`)

| Rule ID | Impact | Affected element | Recommended fix |
|---------|--------|------------------|-----------------|
| `label` | critical | search/filter inputs | Add `aria-label` |
| `select-name` | critical | sort/filter selects | Add `aria-label` |
| `button-name` | critical | icon-only buttons | Add `aria-label` |
| `link-name` | critical | icon-only links | Add `aria-label` |

## Clean views (zero baseline violations)

- `/api/presentations/:id/present?preview=true`
- `/share/:token`
- `/live/:roomCode`

## Disabled rules (project-level decisions)

- `color-contrast` — TipTap editor + reveal themes deliberately use brand colors.
- `landmark-one-main` / `region` — single-page editor design.
- `page-has-heading-one` — editor canvas is the primary content area, no `<h1>`.

## Update flow

When a baseline item is fixed:

1. Remove the rule ID from `A11Y_BASELINE_KNOWN_CRITICAL[<view>]` in
   `tests/e2e/pages/axe-a11y-scan-helper-with-stable-dom-wait.js`.
2. Re-run `npx playwright test tests/e2e/a11y/ --project=chromium`.
3. Update this report.
