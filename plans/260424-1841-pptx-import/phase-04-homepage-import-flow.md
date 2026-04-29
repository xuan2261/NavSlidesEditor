---
phase: 4
title: Homepage Import Flow
status: completed
effort: S
---

# Phase 4: Homepage Import Flow

## Context Links

- Home page: `client/src/pages/HomePage.jsx`
- API helper: `client/src/utils/api.js`
- Existing imports: `client/src/utils/markdown-import.js`, `client/src/utils/import-project.js`

## Overview

Add `.pptx` import to the existing HomePage import sidebar. Reuse current create-presentation flow.

## Requirements

- Add `Import PPTX` row.
- Accept `.pptx` only.
- Add `api.importPptx(file)`.
- Flow: upload/parse -> create presentation -> open presentation.
- Show warning summary for placeholders, unsupported object types, failed media.
- No new importer screen.

## Related Code Files

- Modify: `client/src/utils/api.js`
- Modify: `client/src/pages/HomePage.jsx`
- Create: `client/src/utils/pptx-import-summary.js`

## Implementation Steps

1. Add API helper that posts multipart file to `/api/pptx/import`.
2. Add HomePage handler with progress states.
3. Call existing `api.createPresentation` with returned presentation.
4. Display warning summary when server returns warnings.
5. Navigate/open created presentation.

## Todo List

- [x] API helper
- [x] Sidebar row
- [x] Handler and progress states
- [x] Warning summary
- [x] Navigation after create

## Tests

- API helper posts FormData to `/api/pptx/import`.
- Warning summary includes placeholder and failed-media counts.
- Failed import clears progress and shows error.
- Successful import creates presentation and opens it.

## Success Criteria

- User can import `.pptx` from the HomePage import section.
- Existing PDF/Markdown/Project imports still work.

## Risk Assessment

- Long parse can feel stalled. Mitigation: progress text during upload/parse/create.

## Security Considerations

- Client only accepts `.pptx`; server remains source of truth.

## Next Steps

- Validate against corpus and update docs.
