---
phase: 9
title: "Export Import Sharing And Persistence QA"
status: completed
priority: P1
effort: "1.5 days"
dependencies: [1, 2, 3, 5, 6, 8]
---

# Phase 9: Export Import Sharing And Persistence QA

## Overview

Verify data boundaries affected by Tailwind/refactor work: presentation CRUD, templates, AI routes, imports, exports, sharing, media persistence, and shared render output.

## Requirements

- Presentation data must survive save/reload/export/import after UI edits.
- Exported HTML/PPTX output must include intended slide content, notes, assets, and styles.
- Server validation must accept valid client payloads and reject invalid payloads.
- Sharing/media/template flows must not break due route/schema refactors.
- UI export/import controls must show loading/error/success states.

## Architecture

Persistence/export flow:

Client presentation state -> API route/schema -> server storage/service -> shared render/export utilities -> downloaded artifact or persisted JSON -> reload/import path.

Shared render utilities must stay framework-neutral and safe for server use.

## Related Code Files

- `client/src/utils/exportPptx.js`
- `client/src/utils/import-project.js`
- `client/src/utils/markdown-import.js`
- `server/routes/presentations.js`
- `server/routes/templates.js`
- `server/routes/ai.js`
- `server/middleware/schemas.js`
- `shared/src/htmlGenerator.js`
- `shared/tests/htmlGenerator.test.js`
- `tests/e2e/export.spec.js`
- `tests/e2e/sharing.spec.js`
- `tests/e2e/media.spec.js`
- `tests/e2e/templates.spec.js`
- `tests/e2e/ai.spec.js`
- `client/src/utils/import-project.test.js`
- `client/src/utils/markdown-import.test.js`
- `client/src/utils/media-detector.test.js`

## Implementation Steps

1. Verify presentation CRUD:
   - Create.
   - Read/list.
   - Update after property/canvas edits.
   - Duplicate if supported.
   - Delete and restore/empty state if supported.
2. Verify schemas:
   - Valid presentation with migrated fields.
   - Missing optional notes/assets.
   - Invalid element dimensions/types.
   - Invalid media/import payloads.
3. Verify import:
   - Markdown import.
   - Project import.
   - Media detection.
   - Imported result opens in editor and properties panel.
4. Verify export:
   - HTML export renders slides and notes.
   - PPTX export includes visible elements.
   - Export handles images/media placeholders gracefully.
   - Download filename and MIME are correct.
5. Verify sharing:
   - Share modal produces link/QR if supported.
   - Link opens expected presentation/live view.
   - Error state when server rejects request.
6. Verify AI route integration where refactor touched route or modal:
   - Request validation.
   - Loading/error display.
   - Result insertion path.

## Verification & Tests

- `npx vitest run client/src/utils/import-project.test.js`
- `npx vitest run client/src/utils/markdown-import.test.js`
- `npx vitest run client/src/utils/media-detector.test.js`
- `npx vitest run shared/tests/htmlGenerator.test.js`
- `npx playwright test tests/e2e/export.spec.js`
- `npx playwright test tests/e2e/sharing.spec.js`
- `npx playwright test tests/e2e/media.spec.js`
- `npx playwright test tests/e2e/templates.spec.js`
- `npx playwright test tests/e2e/ai.spec.js`
- API smoke checks:
  - `GET /api/presentations`
  - `POST /api/presentations`
  - `PUT /api/presentations/:id`
  - `GET /api/templates`
  - live/share endpoints touched by refactor.
- Artifact checks:
  - Exported HTML opens and contains expected slide count.
  - PPTX generation completes and file is non-empty.
  - Imported presentation can be saved and reopened.

## Success Criteria

- [ ] CRUD/import/export/share E2E specs pass.
- [ ] Shared HTML generator tests pass.
- [ ] Invalid payloads produce controlled errors, not crashes.
- [ ] Exported artifacts are non-empty and visibly match edited presentation.

## Risk Assessment

- Risk: UI refactor hides failed save/export state. Mitigation: assert loading/error/success messages and disabled states.
- Risk: schema changes reject existing saved presentations. Mitigation: test old sample presentations if fixtures exist.
- Risk: export uses app CSS assumptions not present in standalone artifact. Mitigation: open exported HTML directly.

## Security Considerations

- Preserve server-side validation and sanitization for HTML/code/import data.
- Do not include local absolute paths, credentials, or tokens in exported artifacts.
- AI route errors must not leak provider secrets.

## Todo List

- [ ] CRUD smoke complete.
- [ ] Import utility tests pass.
- [ ] Export/share/media/template E2E pass.
- [ ] Export artifacts manually verified.

## Next Steps

Proceed to Phase 10 when persistence and artifact output are stable.
