---
phase: 8
title: "Editable PDF Import Spike"
status: pending
priority: P2
effort: "4-6d spike"
dependencies: [1]
---

# Phase 8: Editable PDF Import Spike

## Context Links

- Brainstorm Feature 5: two-mode PDF import.
- Audit finding: current `pdf-import.js` is visual-only raster import.
- Code: `client/src/utils/pdf-import.js`, `client/src/utils/pdf-import.test.js`
- Current route pattern: `server/routes/pptx-import.js`

## Overview

Build a real spike for editable PDF import. Goal is a production decision, not a
full feature commitment. Visual mode remains the default and must not regress.

## Key Insights

- `pdfjs-dist` can render pages and expose text positions, but not robust layout reconstruction.
- PyMuPDF/pdfplumber/Camelot may provide better layout/table extraction but introduce Python packaging cost.
- Electron packaging decision is a blocker.
- OCR should be optional and bounded; scanned PDFs can be slow and inaccurate.

## Requirements

- Functional: keep current Visual mode unchanged.
- Functional: spike Editable mode on real PDF input with text blocks, images, and simple tables.
- Functional: output NavSlides elements with coordinates on 960 x 540 canvas.
- Functional: return warnings for unsupported/scanned/low-confidence pages.
- Non-functional: no fake/mock extraction; spike must parse real PDF files.
- Non-functional: packaging impact for Docker, Node, and Electron must be measured.

## Architecture

```text
PDF upload
  -> Visual mode: existing pdfjs canvas -> PNG slide image
  -> Editable spike: server extractor -> layout blocks -> NavSlides elements
      -> text blocks
      -> images
      -> tables if confidence high
      -> warnings for OCR/unsupported content
```

Decision gate:

```text
If Python packaging acceptable and quality passes sample PDFs -> plan full feature.
If not -> keep Visual mode and document why.
```

## Related Code Files

- Modify: `client/src/utils/pdf-import.js` only to preserve visual mode and optional mode parameter if needed.
- Modify: `client/src/utils/pdf-import.test.js`
- Optional create: `server/routes/pdf-import.js`
- Optional create: `server/services/pdf-import/pdf-extractor.js` or Python bridge script if chosen.
- Optional create: `server/services/pdf-import/pdf-extractor.test.js`
- Optional modify: `server/index.js` route mounting.
- Optional modify: `Dockerfile`, `electron-builder.yml`, `requirements-manual.txt` if Python path is accepted.
- Delete: none.

## Implementation Steps

1. Define sample PDFs: text-heavy, image-heavy, simple table, scanned page, mixed layout.
2. Confirm packaging constraints for Docker and Electron before choosing Python dependency.
3. Implement a small real extractor path behind a non-default flag or dev-only route.
4. Normalize PDF page coordinates to NavSlides 960 x 540.
5. Convert text blocks to editable text elements with font size approximation.
6. Extract images where library support is reliable; otherwise warn.
7. Add table extraction only if confidence is measurable; otherwise defer.
8. Add warnings for scanned pages and OCR-required pages.
9. Compare editable output against visual raster baseline for layout drift.
10. Decide full feature, visual-only, or follow-up spike.

## Todo List

- [ ] Python/Electron packaging decision recorded.
- [ ] Real sample PDFs selected.
- [ ] Visual mode regression tests remain green.
- [ ] Editable spike parses at least text-heavy and simple table PDF.
- [ ] Quality/latency metrics captured.
- [ ] Full feature go/no-go documented.

## Verification & Tests

```bash
npm run test -- client/src/utils/pdf-import.test.js
npm run test -- server/services/pdf-import/pdf-extractor.test.js
npm run lint
npm run build
```

Manual spike checks:

- Import a text-heavy PDF and edit extracted text.
- Import a scanned PDF and verify warning/fallback.
- Import a table PDF and verify either editable table or explicit fallback warning.
- Compare generated slide against visual raster reference.

## Success Criteria

- [ ] Current visual PDF import behavior is unchanged.
- [ ] Editable spike uses real extraction, not mocks.
- [ ] Packaging cost and runtime dependencies are documented.
- [ ] Decision exists before full editable PDF build starts.

## Risk Assessment

- Risk: Python runtime increases Electron size and install friction.
- Mitigation: decide packaging first; consider server-only editable mode if desktop cost is too high.
- Risk: layout extraction quality disappoints users.
- Mitigation: keep explicit Visual mode and confidence warnings.

## Security Considerations

- Enforce file size/page count/time limits.
- Do not execute embedded PDF JavaScript or attachments.
- OCR/temp files must be cleaned after processing.
- Keep upload MIME validation and route rate limiting.

## Next Steps

Create a separate full editable PDF implementation plan only after spike passes.

## Unresolved Questions

- Is Python acceptable in Electron builds?
- What minimum extraction accuracy is good enough for Editable mode?
