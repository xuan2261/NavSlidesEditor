# Phase 05 - Port Typography And Export Consistency

## Context Links

- [Plan](./plan.md)
- [Candidate Matrix](./reports/candidate-matrix.md)
- [Impact Report](../reports/researcher-260514-upstream-selective-port-impact.md)

## Overview

- Priority: P1
- Status: Complete, no code port needed
- Goal: port high-fit typography improvements only where they align with local editor, present mode, and export pipelines.

## Key Insights

- Local already has `FontFamily` and `FontSize` extensions.
- Upstream commits around LaTeX/font controls may be portable, but direct cherry-pick may not fit local architecture.
- Changes here can affect editor, present mode, HTML export, PDF/PPTX export, and import mapping.

## Requirements

- Functional:
  - Typography settings remain consistent between editor canvas, present mode, and export.
  - Any added LaTeX/TikZ font size control works without breaking existing math rendering.
  - Existing text font family/size behavior remains backward compatible.
- Non-functional:
  - No broad toolbar rewrite.
  - No unrelated dependency upgrade.
  - Avoid new global style leakage.

## Architecture

```text
Toolbar/Properties -> TipTap extensions / element props -> shared renderers -> HTML/PDF/PPTX export
```

## Related Code Files

- Modify as needed:
  - `client/src/components/Toolbar.jsx`
  - `client/src/extensions/FontFamily.js`
  - `client/src/extensions/FontSize.js`
  - `shared/src/element-renderers.js`
  - `shared/src/htmlGenerator.js`
  - `client/src/utils/export-pptx-text-runs.js`
  - `server/services/pptx-import/mapper.js`
  - `server/services/pptx-import/property-mapping.test.js`
- Create:
  - Focused tests only where gaps exist.
- Delete: none.

## Implementation Steps

1. Inspect candidate commits:
   ```powershell
   git show --name-status --stat 315eee97
   git show --name-status --stat 6d971eb0
   git show --name-status --stat 53173592
   git show --name-status --stat 6c3ef006
   ```
2. Verify local already-aligned behavior:
   ```powershell
   rg -n "42px|16px|section|font-size|FontSize|FontFamily" client/src shared server
   ```
3. Decide per candidate:
   - Direct cherry-pick if file paths and logic align.
   - Manual port if upstream file structure diverges.
   - Skip if behavior already exists.
4. Add or adjust tests before functional code where feasible:
   - Text run export consistency.
   - HTML generator typography rendering.
   - PPTX import property mapping.
5. Implement minimal changes.
6. Run focused test gate.
7. Commit:
   ```powershell
   git add <files>
   git diff --cached --check
   git commit -m "fix(typography): align editor and export text styling"
   ```

## TDD / Verification

- Before implementation:
  ```powershell
  npm run test -- client/src/utils/export-pptx-text-runs.test.js
  npm run test -- shared/tests/htmlGenerator.test.js
  npm run test -- shared/tests/element-renderers.test.js
  npm run test -- server/services/pptx-import/property-mapping.test.js
  ```
- After implementation:
  ```powershell
  npm run lint
  npm run build
  npm run test -- client/src/utils/export-pptx-text-runs.test.js
  npm run test -- shared/tests/htmlGenerator.test.js
  npm run test -- shared/tests/element-renderers.test.js
  npm run test -- server/services/pptx-import/property-mapping.test.js
  npm run test:e2e -- tests/e2e/element-properties.spec.js
  npm run test:e2e -- tests/e2e/toolbar-elements.spec.js
  npm run test:e2e -- tests/e2e/export.spec.js
  ```
- Optional if import/export touched:
  ```powershell
  npm run test:corpus
  ```
- Manual:
  - Edit text font size/family.
  - Edit LaTeX/TikZ if changed.
  - Present slide.
  - Export HTML/PDF/PPTX and inspect typography.

## Todo List

- [x] Inspect candidate typography commits.
- [x] Confirm already-aligned text spacing fixes.
- [x] Add focused regression tests where existing coverage applied.
- [x] Document no local typography code port needed.
- [x] Run targeted unit tests.
- [x] Run targeted E2E tests.
- [x] Confirm no topic commit needed.

## Success Criteria

- Typography behavior is stable across editor/present/export.
- No unrelated toolbar or renderer regression.
- Tests pass.

## Risk Assessment

- Risk: changing shared renderer breaks offline export.
  - Mitigation: run `htmlGenerator`, `element-renderers`, and export E2E.
- Risk: CSS unit mismatch changes visual layout.
  - Mitigation: compare editor and present mode manually.

## Security Considerations

- Do not introduce unsafe inline style injection from untrusted content.
- Preserve trusted-author HTML model; do not add broad sanitization that breaks embeds.

## Next Steps

- Proceed to Phase 06 HTML embed verification.
