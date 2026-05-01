---
phase: 6
title: "Import Export Reliability"
status: completed
priority: P2
effort: "5h"
dependencies: [1]
---

# Phase 6: Import Export Reliability

## Context Links
- [Plan](./plan.md)
- `client/src/utils/markdown-import.js`
- `client/src/utils/pdf-import.js`
- `client/src/utils/import-project.js`
- `client/src/utils/export-pptx-raster.js`
- `client/src/utils/offlineExport.js`
- `shared/src/htmlGenerator.js`

## Overview
Fix reliability bugs in import/export without disabling interactive HTML export.

## Key Insights
- Markdown link href validation is safe; does not touch HTML embeds.
- Import failures currently degrade silently.
- Export caches are module-level and need explicit lifecycle cleanup.

## Requirements
- Functional: Markdown import rejects unsafe link schemes.
- Functional: PDF import reports page upload failures.
- Functional: project import reports missing media rehydration.
- Functional: raster/offline caches clear after success and failure.
- Non-functional: preserve interactive HTML export and custom HTML scripts.

## Architecture
Add focused utilities:
- `client/src/utils/url-safety.js` for link schemes.
- `client/src/utils/import-result.js` for partial success/failure summary if needed.
- cache cleanup using `try/finally` around export entry points.

Allowed link schemes:
- `http:`, `https:`, `mailto:`, relative paths, anchors.
- reject `javascript:`, `data:` unless explicitly needed for images outside href.

## Related Code Files
- Create: `client/src/utils/url-safety.js`
- Modify: `client/src/utils/markdown-import.js`
- Modify: `client/src/utils/pdf-import.js`
- Modify: `client/src/utils/import-project.js`
- Modify: `client/src/utils/export-pptx-raster.js`
- Modify: `client/src/utils/offlineExport.js`
- Modify tests:
  - `client/src/utils/markdown-import.test.js`
  - `client/src/utils/pdf-import.test.js`
  - `client/src/utils/import-project.test.js`
  - `client/src/utils/export-pptx-raster.test.js`
  - `client/src/utils/offlineExport.test.js`

## Implementation Steps
1. Add `isSafeHref()` helper.
2. Use helper in Markdown import link replacement.
3. Return/import warning summary for rejected links.
4. Update PDF import:
   - collect failed pages.
   - return `{ slides, warnings }` or throw if all pages fail.
   - update callers accordingly.
5. Update project import media upload:
   - collect failed media.
   - expose warnings to UI.
6. Add cache cleanup APIs:
   - `clearPptxRasterAssetCaches()`.
   - call in `finally` at export entry.
7. Ensure `offlineExport` clears cache in `finally`, not success-only.

## Todo List
- [x] Add safe href utility.
- [x] Patch Markdown import.
- [x] Patch PDF import failure reporting.
- [x] Patch project import media warning.
- [x] Add export cache cleanup.
- [x] Add tests for success and failure paths.

## Tests / Verification
- Unit:
  - `javascript:alert(1)` link becomes plain text or safe `#`.
  - relative/http/mailto links survive.
  - PDF page upload failure reports warning.
  - all PDF page failures fail loudly.
  - project media upload failure returns warning and does not pretend full success.
  - export caches clear after thrown error.
- Commands:
  - `npm run test -- client/src/utils/markdown-import.test.js`
  - `npm run test -- client/src/utils/pdf-import.test.js client/src/utils/import-project.test.js`
  - `npm run test -- client/src/utils/export-pptx-raster.test.js client/src/utils/offlineExport.test.js`
  - `npm run build`

## Success Criteria
- [x] Unsafe Markdown href blocked.
- [x] Partial import failures visible.
- [x] Export caches bounded/cleared.
- [x] Interactive HTML export unchanged.

## Risk Assessment
- Risk: caller contracts for import return values change.
- Mitigation: keep backward-compatible shape or add optional `warnings`.

## Security Considerations
- URL safety only for Markdown import links.
- No sanitization of HTML embed scripts.

## Next Steps
- Phase 7 targeted text/markdown/svg safety.
