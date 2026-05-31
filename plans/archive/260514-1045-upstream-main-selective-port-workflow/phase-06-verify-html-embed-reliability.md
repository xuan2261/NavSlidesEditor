# Phase 06 - Verify HTML Embed Reliability

## Context Links

- [Plan](./plan.md)
- [Impact Report](../reports/researcher-260514-upstream-selective-port-impact.md)
- [Security Model](../../README.md)

## Overview

- Priority: P1
- Status: Complete, no code port needed
- Goal: reproduce and fix only a real local HTML embed present/export defect. Skip if local implementation already avoids upstream issue.

## Key Insights

- Upstream has commits `347d6ad8` and `cde1b2e9` changing HTML embeds from `srcdoc` to blob/data URLs.
- Local report says local uses `srcdoc`/`data-pdf-iframe`, so upstream change is only partially applicable.
- NavSlides intentionally treats HTML embeds as trusted author content. Security scans must distinguish intentional trusted execution from cross-boundary XSS.

## Requirements

- Functional:
  - Confirm whether HTML embeds fail in present mode, share page, offline HTML, PDF, or PPTX export.
  - If defect exists, fix minimum failing path.
  - If no defect exists, document skip decision.
- Non-functional:
  - No blanket sanitizer rewrite.
  - No change to trusted author content model unless explicitly planned.
  - No unnecessary blob/data URL migration.

## Architecture

```text
HTML element -> shared renderer -> editor iframe / present mode / share/export surfaces
```

## Related Code Files

- Modify only if defect reproduced:
  - `shared/src/element-renderers.js`
  - `shared/src/htmlGenerator.js`
  - `client/src/utils/offlineExport.js`
  - `client/src/utils/generateHTML.js`
  - `server/routes/pptx-export.js`
- Create/modify tests:
  - `shared/tests/htmlGenerator.test.js`
  - `shared/tests/element-renderers.test.js`
  - `client/src/utils/offlineExport.test.js`
  - `tests/e2e/hardening-regression.spec.js`
  - `tests/e2e/export.spec.js`
- Delete: none.

## Implementation Steps

1. Inspect upstream commits:
   ```powershell
   git show --name-status --stat 347d6ad8
   git show --name-status --stat cde1b2e9
   ```
2. Search local embed paths:
   ```powershell
   rg -n "srcdoc|blob:|URL.createObjectURL|data:text/html|data-pdf-iframe|html embed|type: 'html'|type === 'html'" shared client/src server
   ```
3. Write or run reproduction:
   - Add HTML embed with visible DOM/script behavior.
   - Open editor.
   - Present slide.
   - Export offline HTML.
   - Export PDF/PPTX if path applies.
4. If reproduction fails:
   - Add regression test first.
   - Port only the renderer/export path needed.
5. If no reproduction:
   - Create report entry: skipped, reason, tested surfaces.
6. Commit only if code/test changed:
   ```powershell
   git add <files>
   git diff --cached --check
   git commit -m "fix(export): stabilize trusted html embed rendering"
   ```

## TDD / Verification

- Before implementation/reproduction:
  ```powershell
  npm run test -- shared/tests/htmlGenerator.test.js
  npm run test -- shared/tests/element-renderers.test.js
  npm run test -- client/src/utils/offlineExport.test.js
  npm run test:e2e -- tests/e2e/hardening-regression.spec.js
  ```
- After implementation if changed:
  ```powershell
  npm run lint
  npm run build
  npm run test -- shared/tests/htmlGenerator.test.js
  npm run test -- shared/tests/element-renderers.test.js
  npm run test -- client/src/utils/offlineExport.test.js
  npm run test:e2e -- tests/e2e/hardening-regression.spec.js
  npm run test:e2e -- tests/e2e/export.spec.js
  ```
- Manual:
  - HTML embed renders in editor.
  - HTML embed renders in present mode.
  - Offline export opens and renders embed.
  - PDF/PPTX export path does not hang or blank.

## Todo List

- [x] Inspect upstream HTML embed commits.
- [x] Search local HTML embed implementation.
- [x] Reproduce or disprove defect.
- [x] Confirm existing regression tests cover trusted HTML behavior.
- [x] Confirm no minimal fix needed.
- [x] Document skip because no defect was found.
- [x] Run focused and broad gates.

## Success Criteria

- HTML embed decision is evidence-based.
- If fixed, regression test proves behavior.
- If skipped, no code churn.

## Risk Assessment

- Risk: breaking trusted embed execution.
  - Mitigation: test script/interactive embed behavior intentionally.
- Risk: changing export implementation breaks PDF/PPTX raster.
  - Mitigation: run export E2E and manual export smoke.

## Security Considerations

- Trusted author HTML/CSS/JS is intentional.
- Still review cross-boundary risks: uploads, share links, stored content affecting other sessions, path traversal, credential leakage.

## Next Steps

- Proceed to Phase 07 deferred domain documentation.
