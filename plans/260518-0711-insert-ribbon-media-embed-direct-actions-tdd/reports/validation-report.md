# Validation Report: Insert Ribbon Media/Embed Direct Actions

Date: 2026-05-18

## Requirement Answers

- Expected output: updated plan only now; later implementation changes Insert ribbon so Media/Embed are direct icon-only actions and Advanced uses wider flyout.
- Acceptance: Playwright confirms 1280 no overflow/clipping/overlap; direct Media/Embed actions insert/open correctly; Advanced remains keyboard reachable.
- Out of scope: multi-row ribbon, wholesale ribbon redesign, new packages, changing element creation semantics, changing trusted content policy.
- Constraints: React/Vite, current Button variants, existing Playwright helper contracts, no fake/mocked behavior just to pass tests.
- Touchpoints: Insert ribbon component, dropdown/flyout component, E2E helpers/specs, changelog.

## Validation Decisions

- TDD required because current tests encode old dropdown behavior.
- Hard gate: do not implement visual change before tests fail for current behavior.
- Use real browser measurement; static width math is insufficient due fixed side panels.
- Keep smaller viewport expectation pragmatic: no overlap/clip; scroll acceptable below 1280.

## Unresolved Questions

- None.

