---
phase: 7
title: "Phase 8: Editable PDF Import Spike"
status: deferred
priority: P2
effort: "4-6d spike"
dependencies: [0]
reason: "P2 gated; Python/Electron packaging decision not yet made; Node.js path needs evaluation"
---

# Phase 7: Editable PDF Import Spike

## Context Links

- Predecessor: Phase 0 (baseline) — `pdf-import.js` is visual-only raster import via `pdfjs-dist`
- Code: `client/src/utils/pdf-import.js`, `client/src/utils/pdf-import.test.js`
- Server pattern: `server/routes/pptx-import.js` (route structure reference)
- Docs: `docs/pptx-import-fidelity-report.md` (for PDF mention if applicable)

## Overview

Build a real spike for editable PDF import. Goal is a **production decision**, not a full
feature commitment. Visual mode remains the default and must not regress.

**Priority: P2** — can run in parallel with Phase 4 or Phase 5.

## Key Insights

- `pdfjs-dist` renders pages and exposes text positions, but not robust layout reconstruction.
- PyMuPDF/pdfplumber/Camelot may provide better layout/table extraction but introduce Python packaging cost.
- Electron packaging decision is a blocker before choosing Python dependency.
- OCR should be optional and bounded; scanned PDFs are slow and inaccurate.

## Decision Gate

```
If Python packaging acceptable AND quality passes sample PDFs
  -> plan full feature
Else
  -> keep Visual mode, document why
```

## Architecture

```
PDF upload
  -> Visual mode (existing): pdfjs canvas -> PNG slide image
  -> Editable spike (new): server extractor -> layout blocks -> NavSlides elements
        -> text blocks
        -> images
        -> tables if confidence high
        -> warnings for OCR/unsupported content
```

## Related Code Files

- Read: `client/src/utils/pdf-import.js` (preserve visual mode)
- Read: `client/src/utils/pdf-import.test.js`
- Modify: `client/src/utils/pdf-import.js` (add mode parameter if needed)
- Create: `server/routes/pdf-import.js` (optional)
- Create: `server/services/pdf-import/pdf-extractor.js` or Python bridge script
- Create: `server/services/pdf-import/pdf-extractor.test.js`
- Optional modify: `server/index.js` route mounting
- Optional modify: `Dockerfile`, `electron-builder.yml` (if Python accepted)

## Implementation Steps

### 1. Packaging Decision First

Before choosing extraction method:
- Check Electron packaging constraints for Python runtime
- Check Docker image size impact
- Confirm acceptable runtime dependencies

If Python NOT acceptable: spike server-only via Node.js libraries (pdf-parse, pdf2json) instead.

### 2. Define Sample PDFs

Select real PDFs covering:
- Text-heavy: academic paper, report
- Image-heavy: presentation, scanned pages
- Simple table: data table, pricing sheet
- Scanned page: low-quality OCR test
- Mixed layout: magazine-style, multi-column

### 3. Spike Editable Mode

Implement small real extractor behind a non-default flag or dev-only route:

**Node.js path (if Python rejected):**
```js
// server/services/pdf-import/pdf-extractor-node.js
import pdf from 'pdf-parse'

export async function extractEditablePDF(buffer) {
  const data = await pdf(buffer)
  return data.pages.map(page => ({
    textBlocks: extractTextBlocks(page),
    images: extractImages(page),
    tables: [], // pdf-parse limited table support
    warnings: detectScannedPages(page),
  }))
}
```

**Python path (if accepted):**
```python
# server/services/pdf-import/pdf-extractor.py
import fitz  # PyMuPDF
import pdfplumber

def extract_editable_pdf(buffer):
    doc = fitz.open(stream=buffer)
    results = []
    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        results.append(parse_blocks(blocks))
    return results
```

### 4. Normalize Coordinates

Convert PDF page coordinates to NavSlides 960 x 540 canvas.

### 5. Extract Text Blocks

Convert text blocks to editable text elements:
- Preserve approximate font size (PDF units -> pixels -> em)
- Keep bounding box coordinates
- Merge multi-line text into paragraph blocks

### 6. Extract Images

Extract images where library support is reliable:
- PyMuPDF: `page.get_images()`
- pdf-parse: limited; may need pdfimages CLI

If extraction unreliable: warn and skip.

### 7. Extract Tables (if confidence measurable)

Only add table extraction if:
- Confidence is measurable (pdfplumber returns cell boundaries)
- Accuracy passes sample PDFs

Otherwise: defer, add as warning.

### 8. Scanned Page Handling

Detect scanned pages:
- Very little text extractable
- Heavy image content
- No text blocks within expected bounds

Warn: "This page appears to be a scanned image. Consider using OCR or the Visual mode instead."

### 9. Compare vs Visual Baseline

For each sample PDF:
- Visual mode: render page as PNG, insert as single image slide
- Editable mode: extract text/image/table elements
- Compare layout drift: does editable output match visual reference?

### 10. Decision Document

Record:
- Quality assessment per PDF type
- Latency per page (measurable spike output)
- Packaging impact
- Recommendation: full feature / visual-only / follow-up spike

## Todo List

- [ ] Python/Electron packaging decision recorded
- [ ] Real sample PDFs selected (5 types)
- [ ] Visual mode regression tests remain green
- [ ] Editable spike parses at least text-heavy and simple-table PDF
- [ ] Quality/latency metrics captured
- [ ] Decision documented: full feature / visual-only / follow-up spike

## Verification Commands

```bash
npm run test -- client/src/utils/pdf-import.test.js
npm run test -- server/services/pdf-import/pdf-extractor.test.js  # if created
npm run lint
npm run build
```

## Manual Spike Checks

- Import text-heavy PDF — edit extracted text
- Import scanned PDF — verify warning/fallback
- Import table PDF — verify editable table or explicit fallback warning
- Compare generated slide against visual raster reference

## Success Criteria

- [ ] Current visual PDF import behavior is unchanged
- [ ] Editable spike uses real extraction, not mocks
- [ ] Packaging cost and runtime dependencies documented
- [ ] Decision exists before full editable PDF build starts

## Risk Assessment

- Risk: Python runtime increases Electron size.
  - Mitigation: decide packaging first; server-only editable mode if desktop cost too high.
- Risk: layout extraction quality disappoints users.
  - Mitigation: keep explicit Visual mode and confidence warnings.

## Security Considerations

- Enforce file size/page count/time limits.
- Do not execute embedded PDF JavaScript or attachments.
- OCR/temp files must be cleaned after processing.
- Keep upload MIME validation and route rate limiting.

## Next Steps

Proceed to Phase 8 (analytics) or Phase 9 (docs) after this spike completes.
