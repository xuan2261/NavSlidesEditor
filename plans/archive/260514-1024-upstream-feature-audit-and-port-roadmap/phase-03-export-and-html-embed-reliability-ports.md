# Phase 03 - Export And HTML Embed Reliability Ports

## Context Links

- [Plan](./plan.md)
- [Candidate matrix phase](./phase-02-upstream-candidate-matrix.md)
- Relevant upstream commits: `cde1b2e9`, `347d6ad8`, `53173592`, `6c3ef006`, `edfc1ba5`

## Overview

- Priority: P1
- Status: Complete
- Estimate: 6h
- Goal: verify and port only export/present reliability fixes that fit local shared renderer.

## Key Insights

- Local HTML export uses `shared/src/htmlGenerator.js` and `shared/src/element-renderers.js`.
- Local PDF path intentionally uses `data-pdf-iframe` + blob initialization.
- HTML embeds are trusted author content per README security model.

## Requirements

- Do not blindly copy upstream `generateHTML.js`.
- Preserve trusted HTML embed behavior.
- Preserve PDF export behavior.
- Verify section/font-size/px spacing already aligned before changing.
- Add or update tests for any behavior changed.

## Architecture

```text
Editor element model
  -> shared element renderer
     -> present HTML iframe path
     -> print/PDF iframe path
  -> htmlGenerator
     -> reveal section layout
     -> footer/grid/notes
```

## Related Code Files

- Modify if needed:
  - `shared/src/element-renderers.js`
  - `shared/src/htmlGenerator.js`
  - `shared/tests/element-renderers.test.js`
  - `shared/tests/htmlGenerator.test.js`
  - `client/src/utils/offlineExport.js`
  - `client/src/utils/offlineExport.test.js`
  - `server/routes/pptx-export.test.js`
- Read:
  - `client/src/components/canvas/element-renderers/latex-element-renderer.jsx`
  - `client/src/utils/export-pptx-raster.js`
  - `server/routes/pptx-export.js`
- Delete: none.

## Implementation Steps

1. Write focused baseline tests before changes:
   - HTML embed present output renders an isolated iframe.
   - PDF output uses `data-pdf-iframe` or approved replacement.
   - section font size uses `16px * var(--font-zoom, 1)`.
   - element positioning uses px, not em.
2. Compare upstream commits:
   ```powershell
   git show cde1b2e9
   git show 347d6ad8
   git show 53173592
   git show 6c3ef006
   git show edfc1ba5
   ```
3. Decide per behavior:
   - If local already passes, mark `already-aligned`; no code.
   - If local fails, patch local shared renderer only.
4. For HTML embed present mode, prefer minimal change:
   - keep `srcdoc` if current tests/manual smoke pass.
   - use data URL only if it fixes a proven present-mode failure.
   - never remove isolation without documented reason.
5. For LaTeX present path:
   - verify local client renderer and shared export renderer produce consistent scale/color.
   - avoid new iframe path unless needed.

## Todo List

- [x] Add/confirm baseline tests.
- [x] Compare upstream behavior to local.
- [x] Patch only failing local behavior.
- [x] Run focused tests.
- [x] Record port decisions in matrix.

## Success Criteria

- Present mode HTML embeds still display.
- PDF export path still works.
- HTML export layout remains pixel-aligned with editor.
- No regression to trusted author content support.

## Verification

Required:
```powershell
npm run lint
npm run build
npm run test -- shared/tests/element-renderers.test.js shared/tests/htmlGenerator.test.js
```

Targeted if files touched:
```powershell
npm run test -- client/src/utils/offlineExport.test.js
npm run test -- server/routes/pptx-export.test.js
npm run test:e2e -- tests/e2e/export.spec.js
npm run test:e2e -- tests/e2e/hardening-regression.spec.js
```

Manual smoke:
- Create HTML embed with script.
- Present.
- Export HTML.
- Export PDF.
- Export PPTX if raster path touched.

## Risk Assessment

- Risk: iframe URL changes break offline export or PDF.
- Mitigation: keep separate present vs print behavior and test both.

## Security Considerations

- Trusted author content is allowed.
- Still block cross-boundary issues: path traversal, credential leaks, share link escalation.

## Next Steps

- Proceed to Phase 04 editor UX micro ports.

## Unresolved Questions

- None if local tests can prove current behavior.
