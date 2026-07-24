# Phase 03 - Unit And Component Deep Coverage

## Context Links

- [Plan](./plan.md)
- [Phase 02](./phase-02-coverage-matrix-expansion-model.md)
- `client/src/components/properties/`
- `client/src/components/ribbon/`
- `client/src/components/canvas/`
- `client/src/hooks/`
- `client/src/stores/`
- `shared/src/element-renderers.js`

## Overview

Priority: P0  
Status: completed  
Description: Add cheap, deterministic tests for element controls and core logic. Use unit/component tests before browser E2E unless DOM integration is the behavior under test.

## Key Insights

- Most control bugs are value-routing bugs: control -> updateElement -> store -> renderer/export.
- Component tests are faster and less flaky than Playwright for properties/ribbon logic.
- High-risk paths need edge cases: multi-select, mixed values, locked elements, invalid inputs.

## Requirements

- Add failing-first tests for high-risk controls and render mappings.
- Cover each canonical element type with at least one meaningful property mutation where applicable.
- Verify persistence payload shape at store/helper level.
- Keep new files under 200 LOC where practical.
- Do not add test-only production APIs unless Phase 1 proves no stable public seam exists.

## Architecture

Use focused seams:

```text
control component -> onUpdate assertion
store operation -> presentation state assertion
renderer -> HTML/style assertion
export helper -> artifact fragment assertion
```

## Related Code Files

Modify:
- Existing tests under `client/src/components/**/__tests__` or adjacent `*.test.*`
- Existing tests under `client/src/hooks/`
- Existing tests under `client/src/stores/`
- Existing tests under `shared/tests/`
- Test helpers only if duplication appears.

Create:
- Focused `*.test.jsx` / `*.deep.test.jsx` files for missing element-control groups.

Delete:
- None.

## Implementation Steps

1. From Phase 1 report, pick P0 control groups first: position/size/rotation, opacity, color, media source, table, chart, markdown, SVG, timeline, game.
2. For each group, write a failing test for the missing behavior.
3. Add or adjust test helpers only after repeated setup appears 3+ times.
4. Assert both update callback/state and renderer output when the control affects rendering.
5. Add `[cap:* depth:*]` tags per Phase 2.
6. For trusted programmable content, add negative tests only at trust boundaries: imported/untrusted content, share/viewer privilege, path traversal, credential exposure, and unsafe upload parsing.
7. Run targeted Vitest after each slice, then full `npm run test`.

## Todo List

- [x] Cover high-risk shared controls for Format tab position behavior and serialized geometry persistence.
- [x] Cover type-specific properties for 19 canonical element types.
- [x] Cover multi-select indeterminate read/write behavior.
- [x] Cover renderer/export mapping units for chart, table, and timeline.
- [x] Tag all new tests with capability and depth.

## Progress Notes

- Added `depth:behavior` and `depth:persistence` evidence for `control.format.position`.
- Added depth-gated behavior/export evidence for `element.chart`, `element.table`, `element.timeline`, plus behavior evidence for `element.markdown` and `element.svg`.
- Added depth-gated behavior/export evidence for media/code/image/latex/html elements: `element.audio`, `element.code`, `element.html`, `element.image`, `element.latex`, and `element.video`.
- Added depth-gated behavior/export evidence for the remaining canonical element group: `element.text`, `element.shape`, `element.line`, `element.callout`, `element.icon`, `element.qrcode`, and `element.drawing`.
- Updated `coverage-depth-policy.json` so these Phase 3 rows fail warn-first if the new depth evidence is lost.
- Added depth-gated behavior evidence for `flow.multiselect` mixed-value read/write behavior in common and shape property controls.
- Fixed release-facing `docs/codebase-summary.md` version drift discovered by full Vitest.
- Validation: targeted component/renderer tests pass; `npm run matrix:gate`, `npm run lint`, and `npm run build` pass. Fresh `npm run test` passed on 2026-06-16 with 300 test files passed, 1 skipped; 2511 tests passed, 1 skipped.

## Success Criteria

- P0 unit/component coverage gaps from Phase 1 are closed.
- Tests catch a wrong prop name, missing renderer mapping, or dropped persistence field.
- Full Vitest suite passes or has a fresh accepted CI/local run attached before Phase 4 promotion.

## Risk Assessment

- Risk: testing implementation details. Mitigation: assert public callbacks, state, HTML, and serialized data.
- Risk: giant helper abstraction. Mitigation: duplicate small setup until the third repetition.

## Security Considerations

- Include negative tests for SVG/Markdown/HTML boundaries where user content crosses import/export or share surfaces.
- Do not block trusted author HTML by mistake.
- Tests must distinguish trusted author content from untrusted import/upload/share boundaries per README security model.

## Red Team Notes

- Accepted finding: security tests could accidentally attack intentional trusted-author HTML. Phase 3 must target only trust-boundary behavior.

## Next Steps

- Phase 4 adds browser workflows that prove composed UI behavior.

## Unresolved Questions

- None.
