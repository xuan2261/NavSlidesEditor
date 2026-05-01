# Deep Technical Dive: Advanced PPTX Import Fidelity & PDF Import

**NavSlidesEditor - Brainstorm Report**
**Date:** 2026-04-26
**Author:** brainstormer subagent
**Work Context:** D:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo

---

## 1. Current Import System Analysis

### 1.1 PPTX Import Pipeline (Phase 1 - shipped)

```
Upload (.pptx)
  -> server/routes/pptx-import.js (multer upload, 100MB limit)
    -> server/services/pptx-import/importer.js
      -> pptx-guards.js (package validation, ZIP budget, entry count)
      -> worker-runner.js (fork child process, 60s timeout)
        -> parse-worker.js
          -> pptxtojson@2.0.2 (primary parser, base64 images)
          -> pptx2json@0.0.10 (fallback inspector, raw XML dump)
      -> mapper.js (mapPptxOutput: element -> NavSlides schema)
        -> media.js (createMediaIndex, persistImageBuffer)
        -> sanitize.js (DOMPurify HTML sanitization)
        -> chart-output-to-navslides-mapper.js (chart type mapping)
```

**Libraries in use:**
- `pptxtojson@2.0.2` - primary PPTX -> JSON parser
- `pptx2json@0.0.10` - raw XML fallback inspector only
- `jszip@3.10.1` - ZIP extraction
- `dompurify@3.4.0` - HTML sanitization
- `pptxgenjs@4.0.1` - PPTX export

**What Phase 1 maps successfully:**

| Element Type | Status | Fidelity |
|---|---|---|
| Text (rich HTML) | :white_check_mark: Full | Font, color, bold/italic, alignment, hyperlinks |
| Images | :white_check_mark: Full | Base64, media ref, crop, flip, border |
| Basic shapes | :white_check_mark: Full | 15+ shape types, fill, stroke, arrows |
| Tables | :white_check_mark: Full | Merged cells, per-cell style, col widths |
| Lines | :white_check_mark: Full | Real coords, arrow markers, dash arrays |
| Charts | :lock: Locked placeholder | Partial: bar/line/pie type + labels/datasets mapped |
| SmartArt/Diagram | :lock: Locked placeholder | Flattened to 50 rect nodes max |
| Equations | :lock: Locked placeholder | Not detected |
| Groups | :warning: Flattened | Rotation/flip compositing may differ |
| Transitions | :white_check_mark: Full | fade/slide/none with duration/direction |
| Speaker notes | :white_check_mark: Full | Sanitized HTML preserved |
| Slide backgrounds | :white_check_mark: Full | Color, gradient, image |

**Corpus:** 4 real decks / 145 slides. Semantic fidelity: 97.0%, round-trip stability: 99.0%.

### 1.2 PDF Import Pipeline (current - brute force)

```
PDF file
  -> pdf-import.js (pdfjs-dist@5.6.205, browser-side)
    -> Render each page to canvas at scale=2
    -> Canvas -> PNG blob -> api.uploadFile()
    -> One slide with single full-screen image element
```

**Limitations:**
- Renders entire page as raster image -- no text extraction
- No layout preservation (positioned text blocks)
- No image extraction (embedded images inside PDF are lost)
- No table detection
- No per-page text/content analysis
- Scale=2 (2x resolution) creates large PNGs
- Requires network roundtrip for each page upload

### 1.3 Other Import Paths

| Path | Status | Notes |
|---|---|---|
| `.navslides` ZIP/JSON | :white_check_mark: Full | Media rehydration on import |
| Markdown | :white_check_mark: Full | `---` or `## ` slide split, HTML conversion |
| PPTX | :white_check_mark: Phase 1 | See 1.1 above |
| PDF | :warning: Image-only | See 1.2 above |

---

## 2. PPTX Deep Dive: File Structure & Parsing Options

### 2.1 PPTX = OOXML ZIP Container

A `.pptx` is a ZIP with this internal structure:

```
mimetype
_rels/
  .rels
  ppt/_rels/presentation.xml.rels
ppt/
  presentation.xml          <- slide list, master refs, layout refs
  slideMasters/
    slideMaster1.xml        <- master theme, background, placeholders
  slideLayouts/
    slideLayout1.xml        <- layout templates
  slides/
    slide1.xml              <- slide content (shapes, text, images)
    slide2.xml
  media/
    media1.png              <- embedded images
    media2.jpg
  charts/
    chart1.xml              <- DrawingML chart definition
    chart1.xlsx             <- embedded Excel data (bar, line, pie)
    chart2.xml
  diagrams/
    diagram1.xml            <- SmartArt data
  notesSlides/
    notesSlide1.xml         <- speaker notes
  theme/
    theme1.xml              <- color/font/scheme definitions
  notesMasters/
    notesMaster1.xml
```

### 2.2 What pptxtojson MISSES

#### Charts -- The Hard Problem

Charts in PPTX are stored as:
1. `ppt/charts/chartN.xml` - DrawingML chart definition (axes, series, legend, plot area geometry)
2. `ppt/charts/chartN.xlsx` - Embedded Excel spreadsheet with actual data values

**pptxtojson extracts chart XML but does NOT extract the embedded Excel data.** The chart data array comes from parsing the DrawingML XML series definitions, which contain formula references like `Sheet1!$B$2:$B$5` rather than actual values. This is why current chart import produces incomplete datasets.

**Chart types in PPTX:** Bar/Column, Line, Pie/Doughnut, Scatter, Radar, Stock, Surface, Bubble, Treemap, Sunburst, Pareto, Box & Whisker, Waterfall, and more.

**Gap:** Complex types (treemap, sunburst, box-whisker, waterfall) cannot be natively rendered by Chart.js.

#### SmartArt -- The Nightmare

SmartArt is stored in `ppt/diagrams/` as:
- `dataN.xml` - Hierarchical node structure
- `designN.xml` - Visual layout/arrangement
- `drawingN.xml` - Actual rendered SVG-like shapes

SmartArt is NOT a simple XML structure. Microsoft uses a proprietary diagramming engine with layout algorithms, baked animations, complex text inheritance, and layout-specific coordinate transforms.

**Best approach:** Rasterize SmartArt to image.

#### Equations (OMML)

Office Math Markup Language equations stored in `<a14:m>` tags or `ppt/equationN.xml` files.

OMML -> LaTeX conversion exists but is lossy for complex layouts.
**Fallback:** Rasterize equation to image (same approach as LaTeX export in current codebase).

### 2.3 Parsing Strategy Options

| Option | Pros | Cons | Effort |
|---|---|---|---|
| **A: Pure JS + pptxtojson enhancement** | No new runtime deps; stays in current pipeline | pptxtojson wont extract embedded Excel | Medium |
| **B: Server-side Python (python-pptx + openpyxl)** | Full chart data extraction | New Python runtime; more complex infra | High |
| **C: Hybrid JS (custom XML parsing for charts)** | Extends current pipeline; chart data from embedded xlsx via JSZip | Complex; xlsx format is tricky | High |
| **D: Raster-first for complex elements** | Simplest path to 'good enough' | NOT editable | Low |


---

## 3. PDF Deep Dive: Libraries & Approaches

### 3.1 The PDF Problem

PDF is a **print-format** not a document format. Unlike PPTX, PDF has no semantic structure:
- No 'slide' concept -- just pages
- No 'text block' -- just glyphs positioned at coordinates
- No 'table' -- just text arranged in columns
- No 'image' distinction -- images are content streams

### 3.2 Text Extraction Libraries Comparison

| Library | Type | Text Positions | Layout | Images | Tables | Notes |
|---|---|---|---|---|---|---|
| **pdfjs-dist** | Browser/Node | :white_check_mark: Bounding boxes | :warning: Limited | :x: | :x: | NavSlides currently uses this |
| **pdf-parse** | Node.js | :white_check_mark: Text content | :warning: Lines only | :x: | :x: | No layout analysis |
| **pdfminer.six** | Python | :white_check_mark: Full | :white_check_mark: Heaps | :white_check_mark: Extract | :warning: Basic | Gold standard for layout |
| **pymupdf (fitz)** | Python | :white_check_mark: Full | :white_check_mark: Blocks | :white_check_mark: Extract | :warning: Basic | Fast, modern, excellent API |
| **camelot** | Python | :x: | :x: | :x: | :white_check_mark: Best | Table detection |
| **pytesseract** | Python | OCR | OCR | OCR | :x: | Tesseract OCR engine |

### 3.3 PDF to Slides Mapping Strategies

**Strategy 1: Per-Page Raster (current)** - Render each page to PNG -> one image per slide. Simple, preserves everything visually, but NOT editable.

**Strategy 2: Content-Block Extraction (pymupdf / pdfminer.six)** - Extract text blocks with bounding boxes, detect columns, detect tables, create positioned elements. Most editable but complex.

**Strategy 3: Hybrid (recommended)** - Offer two import modes: **Visual (raster)** vs **Editable (structured)**.

### 3.4 Scanned PDF Challenge

Scanned PDFs contain no text -- just images of pages. OCR required:

| Option | Accuracy | Speed | Cost |
|---|---|---|---|
| Tesseract (pytesseract) | 85-95% | Slow | Free |
| Google Cloud Vision API | 99%+ | Fast | Pay-per-use |
| AWS Textract | 99%+ | Fast | Pay-per-use |

**Recommendation:** Offer Tesseract as free option, cloud APIs as premium. Fallback to raster mode if OCR unavailable.


---

## 4. Proposed Architecture: PPTX Enhancement

### 4.1 Recommended Approach

**Option C (Hybrid JS) + Option D (Raster for complex types)**

- Avoids adding Python runtime (keeps infra simple)
- Extends current pptxtojson pipeline
- Charts: extract embedded Excel via JSZip + custom xlsx parser
- SmartArt/equations: rasterize to image placeholders
- Groups: improve flattening algorithm

### 4.2 Architecture Diagram

```
PPTX file
  |
  v
pptx-guards.js (existing: ZIP budget, entry count)
  |
  v
Worker Process (child_process.fork)
  |
  +-- pptxtojson (primary parser)
  |
  +-- JSZip direct access
  |    (chart xlsx extraction, SmartArt XML reading)
  |
  |   +-- Chart Enhancement Module (NEW) --+
  |   |  - Read embedded xlsx (sharedStrings +  |
  |   |    sheetData -> data arrays)         |
  |   |  - Merge with DrawingML series        |
  |   |  - Complex types -> raster fallback  |
  |   +--------------------------------------+  |
  |                                              |
  |   +-- SmartArt Raster --+
  |   |  - Simple diagrams -> shapes (recreate) |
  |   |  - Complex -> Playwright raster        |
  |   +-----------------------+                 |
  |                                              |
  |   +-- Equation Raster --+
  |   |  - OMML -> Playwright -> PNG           |
  |   +---------------------+                   |
  |                                              |
  +-- mapper.js (existing + enhanced)
       |
       v
  NavSlides JSON presentation
```

### 4.3 Chart Enhancement Detail

**Embedded Excel extraction path:**
```
ppt/charts/chart1.xlsx (inside ZIP)
  -> JSZip extracts raw bytes
  -> Custom xlsx parser:
       xl/sharedStrings.xml -> string table
       xl/worksheets/sheet1.xml -> cell refs + values
  -> Map cell values to chart data arrays
  -> Merge with DrawingML axis/series metadata
  -> Output: { labels: [...], datasets: [{ label, data: [...] }] }
```

**Fallback for complex chart types:**

| Chart Type | Action | Editable? |
|---|---|---|
| Bar/Column/Line/Pie/Doughnut/Radar | Map to Chart.js | :white_check_mark: Yes |
| Scatter | Map (already done) | :white_check_mark: Yes |
| Bubble | Map to bar + bubble sizing | :warning: Partial |
| Stock/Treemap/Sunburst/Box-Whisker/Waterfall | Raster fallback | :x: No |

### 4.4 SmartArt Enhancement

SmartArt has 3 levels of complexity:
1. **Simple (2-5 nodes):** Extract text nodes, create individual shapes with arrows -> manageable via current `flattenDiagramElement`
2. **Moderate (5-20 nodes):** Rasterize via Playwright
3. **Complex nested:** Rasterize to image placeholder

**Implementation:**
1. Read `ppt/diagrams/dataN.xml` -> extract `dt:point` elements with text
2. Read `ppt/diagrams/designN.xml` -> extract layout type
3. If node count <= 20 and layout is simple -> recreate as shapes
4. Otherwise -> render to image via Playwright

### 4.5 Equation Enhancement

OMML equations in PPTX: `<a14:m><m:oMathPara>...</m:oMathPara></a14:m>`

**Approach:** Use Playwright (already a dependency) to render equations. Create a hidden slide with the equation, render to canvas, extract PNG.


---

## 5. Proposed Architecture: PDF Import

### 5.1 Recommended Approach

**Two-mode import: Visual (raster) vs Editable (structured)**

- **Visual mode** (default, current): Render to PNG -> one image element per page
- **Editable mode** (new): Extract text blocks, images, tables -> positioned elements via server-side Python

### 5.2 Architecture Diagram

```
PDF file
  |
  +-- [Visual Mode]
  |     pdfjs-dist canvas render
  |       -> PNG blob -> api.uploadFile()
  |       -> One slide per page, one image element
  |
  +-- [Editable Mode -- server-side Python]
        |
        v
  Python subprocess
  (pymupdf + camelot + pytesseract)
        |
        +-- For each page:
        |     +-- pymupdf.get_text('dict')
        |     |     -> blocks[] with bbox + spans
        |     |     -> Column detection
        |     |     -> Heading/list heuristics
        |     |
        |     +-- pymupdf.find_tables()
        |     |     -> table data + positions
        |     |
        |     +-- pymupdf.get_images()
        |     |     -> image bytes + positions
        |     |
        |     +-- OCR (if no text extracted)
        |           -> pytesseract or Google Vision
        |
        Scale: PDF points -> 960x540 canvas
        Output: JSON { slides[], warnings[] }
        |
        v
  server/routes/pdf-import.js
  (parse Python stdout, upload images, normalize)
        |
        v
  NavSlides JSON presentation
```

### 5.3 Two-Mode Decision Tree

```
PDF uploaded
  |
  +-- User selects 'Visual Import'
  |     -> Current behavior: one image per page
  |     -> Simple, fast, preserves everything
  |
  +-- User selects 'Editable Import'
        -> Server-side Python subprocess
        -> Try text extraction first
        |
        +-- Text extracted successfully
        |     -> Structured import (text + tables + images)
        |
        +-- No text (scanned/image PDF)
              -> Offer OCR option
              |    +-- 'Try OCR' -> Tesseract (free)
              |    +-- 'Cloud OCR' -> Google Vision (premium)
              -> OR -> fall back to visual mode
```

### 5.4 Table Detection

**Algorithm (pymupdf + camelot):**

```python
# pymupdf table detection
tables = page.find_tables()
for table in tables:
    rows = table.extract()  # [[cell_text, ...], ...]
    # Convert to NavSlides table format
```

Fallback: column alignment + horizontal rule detection.


---

## 6. Data Flow Diagrams

### 6.1 Enhanced PPTX Import Data Flow

```
User uploads .pptx
        |
        v
+----------------------------------------+
|  server/routes/pptx-import.js          |
|  multer.upload(file) -> /tmp/uuid.pptx |
+------------------+---------------------+
                   |
                   v
+----------------------------------------+
|  importer.importPptxFile(filePath)     |
|                                        |
|  1. validatePptxPackage()             |
|     - ZIP well-formed?                 |
|     - Entry count <= 5000              |
|     - Decompressed <= 500MB            |
|                                        |
|  2. runParserWorker(filePath)         |
|     - fork child process               |
|     - parse-worker.js:                 |
|       +-- pptxtojson.toJson()         |
|       |                                |
|       +-- For each chart:            |
|       |   +-- Read chartN.xml (DrawingML) |
|       |   +-- Read chartN.xlsx (JSZip)    |
|       |   +-- Parse xlsx: sharedStrings  |
|       |   |   + sheetData -> data arrays |
|       |   +-- Map to Chart.js schema     |
|       |                                |
|       +-- For each diagram:           |
|           +-- Read dataN.xml -> nodes |
|           +-- Read designN.xml -> layout |
|           +-- Complex -> rasterize     |
+------------------+---------------------+
                   |
                   v
+----------------------------------------+
|  mapper.mapPptxOutput(output, zip)     |
|                                        |
|  For each slide:                      |
|    For each element (sorted by z-order) |
|      +-- image -> mapImage()          |
|      +-- table -> mapTable()          |
|      +-- shape -> mapShape()          |
|      +-- text  -> text element         |
|      +-- chart -> mapChart() (enhanced)|
|      +-- group -> flattenGroup()       |
|      +-- diagram -> flattenDiagram     |
|                                        |
|  Background: color|gradient|image      |
|  Transition: fade|slide|none           |
|  Notes: sanitized HTML                 |
+------------------+---------------------+
                   |
                   v
+----------------------------------------+
|  media.js                              |
|  createMediaIndex(zip)                 |
|  persistImageForElement() -> /uploads/ |
+------------------+---------------------+
                   |
                   v
     NavSlides JSON presentation
     stats: { slideCount, textCount,
              chartCount, placeholderCount }
     warnings: [ ... ]
```

### 6.2 PDF Import (Editable Mode) Data Flow

```
User uploads .pdf
        |
        v
+----------------------------------------+
|  client/src/utils/pdf-import.js        |
|  POST to /api/pdf/import (FormData)     |
+------------------+---------------------+
                   |
                   v
+----------------------------------------+
|  server/routes/pdf-import.js (NEW)     |
|  multer.upload -> /tmp/uuid.pdf        |
+------------------+---------------------+
                   |
                   v
+----------------------------------------+
|  Python subprocess                     |
|  python scripts/pdf-import-runner.py   |
|                                        |
|  import pymupdf                        |
|  import camelot                        |
|  doc = pymupdf.open(file)             |
|                                        |
|  For each page:                       |
|    +-- pymupdf.get_text('dict')       |
|    |     -> blocks[] with bbox + spans |
|    |                                    |
|    +-- pymupdf.find_tables().extract() |
|    |     -> table data + positions     |
|    |                                    |
|    +-- pymupdf.get_images()           |
|    |     -> image bytes + positions    |
|    |                                    |
|    +-- Layout analysis:               |
|          - Column detection            |
|          - Reading order (top->bottom) |
|          - Heading detection (font size) |
|                                        |
|  Scale: PDF points -> 960x540 canvas  |
|  Output: JSON { slides[], warnings[] } |
+------------------+---------------------+
                   |
                   v
+----------------------------------------+
|  server/routes/pdf-import.js           |
|  Parse Python stdout (JSON)            |
|  Upload extracted images to /uploads/ |
|  Normalize to NavSlides schema         |
|  Return: presentation JSON + stats   |
+------------------+---------------------+
                   |
                   v
  client/pdf-import-result.js
  -> presentation-store.js
  -> EditorPage renders slides
```

---

## 7. Implementation Phases

### PPTX Enhancement Phases

#### Phase E1: Chart Data Enhancement (4-6 hours)
- Add JSZip access to chart xlsx files in `parse-worker.js`
- Implement minimal xlsx parser (~200 LOC custom JS)
- Merge extracted data with DrawingML series metadata
- Test on corpus decks with charts
- **Risk:** xlsx format edge cases; fallback to raster for complex charts
- **Effort:** Low-Medium

#### Phase E2: SmartArt Improvement (3-5 hours)
- Extend `flattenDiagramElement` for simple diagrams (<=20 nodes)
- Add Playwright raster fallback for complex SmartArt
- **Risk:** SmartArt XML is non-standard; raster is safe fallback
- **Effort:** Medium

#### Phase E3: Equation Support (4-6 hours)
- Detect OMML in shape text runs
- Implement OMML -> LaTeX conversion (bundle `omml2mml.xsl`)
- OR: Playwright raster approach (existing LaTeX pipeline)
- **Risk:** OMML complexity varies; raster fallback always works
- **Effort:** Medium

#### Phase E4: Group Depth & Rotation Improvement (2-3 hours)
- Profile current group flattening on real decks
- Fix rotation/flip compositing edge cases
- **Risk:** Low (well-understood math)
- **Effort:** Low

#### Phase E5: Corpus Expansion + Fidelity Validation (2-4 hours)
- Add 5-10 more real-world decks to corpus
- Re-run semantic fidelity + round-trip tests
- **Risk:** Low
- **Effort:** Low

### PDF Import Phases

#### Phase F1: Server-side Python Runtime Setup (2-3 hours)
- Add Python 3.10+ subprocess support
- Bundle required packages: `pymupdf`, `camelot-py`, `pytesseract` (optional)
- Create isolated Python venv or use system Python
- **Risk:** Python runtime adds infra complexity; Windows compatibility
- **Mitigation:** Check `python3` path; show clear error; visual fallback
- **Effort:** Medium

#### Phase F2: Editable PDF Text Extraction (4-6 hours)
- Python script: pymupdf text block extraction
- Column detection + reading order
- Heading/list detection heuristics
- Scale to 960x540 canvas
- **Risk:** Complex PDFs (multi-column, footnotes) may mis-classify
- **Mitigation:** Fallback to visual mode
- **Effort:** Medium-High

#### Phase F3: Table Detection & Image Extraction (3-5 hours)
- Camelot table detection integration
- pymupdf image extraction with positions
- **Risk:** Table detection accuracy varies widely
- **Effort:** Medium

#### Phase F4: OCR Pipeline (3-4 hours)
- Tesseract integration for scanned PDFs
- Optional: cloud OCR API (Google Vision)
- **Risk:** OCR quality depends on image clarity; Tesseract is slow
- **Mitigation:** Async processing; progress feedback; visual fallback
- **Effort:** Medium

#### Phase F5: UI Integration (2-3 hours)
- Add 'Editable' vs 'Visual' mode toggle in PDF import dialog
- OCR option UI
- Progress reporting for large PDFs
- **Risk:** Low
- **Effort:** Low


---

## 8. Effort Estimates & Risks

### Effort Summary

| Phase | Component | Hours | Risk Level |
|---|---|---|---|
| E1 | Chart data extraction | 4-6 | Medium |
| E2 | SmartArt improvement | 3-5 | Medium |
| E3 | Equation support | 4-6 | Medium |
| E4 | Group/rotation fix | 2-3 | Low |
| E5 | Corpus expansion | 2-4 | Low |
| **E Total** | | **15-24** | |
| F1 | Python runtime setup | 2-3 | Medium |
| F2 | Text block extraction | 4-6 | Medium |
| F3 | Table/image extraction | 3-5 | Medium |
| F4 | OCR pipeline | 3-4 | Medium |
| F5 | UI integration | 2-3 | Low |
| **F Total** | | **14-21** | |
| **Grand Total** | | **29-45** | |

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| xlsx parser edge cases (E1) | Medium | Low | Fallback to raster for unknown formats |
| SmartArt XML too complex (E2) | High | Low | Always have raster fallback |
| OMML conversion quality (E3) | Medium | Medium | Playwright raster always available |
| Python not available on deployment (F1) | Low | High | Check `python3` path; clear error; visual fallback |
| PDF layout misclassification (F2) | High | Medium | User can switch to visual mode |
| Table detection poor on complex PDFs (F3) | High | Low | Fallback to visual mode per-page |
| OCR accuracy insufficient (F4) | Medium | Medium | Clear 'OCR-processed' flag; user can edit |

### Key Trade-offs

| Decision | Chosen | Rationale |
|---|---|---|
| Python runtime for PDF | Yes | pymupdf is far superior to any JS library for layout analysis |
| SmartArt: recreate vs rasterize | Hybrid | Simple diagrams -> recreate; complex -> raster |
| Charts: full fidelity vs fallback | Hybrid | Common types -> fully editable; rare types -> raster |
| Equation: editable vs raster | Raster-first | OMML -> LaTeX is lossy; Playwright raster is reliable |
| PDF: single mode vs dual mode | Dual mode | Visual = fast/simple; Editable = powerful but complex |

### Simplest Viable Path

**PPTX:** Phase E1 (Chart data) alone delivers the highest user-visible improvement -- charts become actually usable with real data. Phase E4 (group fixes) is quick wins.

**PDF:** F1 + F2 + F5 deliver a meaningful editable import. F3 (tables) and F4 (OCR) are incremental.


---

## Unresolved Questions

1. **PPTX charts in embedded xlsx** -- Does pptxtojson already extract chart data in some form we missed, or is the DrawingML XML series data actually usable without the embedded Excel? Need to inspect actual pptxtojson output on a chart-heavy deck.

2. **SmartArt rasterization** -- Can we use the existing Playwright server endpoint to rasterize SmartArt, or do we need a new dedicated endpoint?

3. **Python runtime distribution** -- Should Python be bundled with Electron app? (Electron ships on Windows/macOS/Linux, Python may not be available on all platforms)

4. **PDF import performance** -- For 100+ page PDFs, should we limit concurrent processing? Should we cap elements per slide?

5. **PDF table detection accuracy** -- What is the acceptable accuracy threshold? Should tables default to visual mode if detection confidence is low?

6. **OMML -> LaTeX conversion** -- Has the codebase experimented with any OMML conversion before, or is this entirely new territory?

---

## Assumptions Challenged

- **Assumption:** 'We need to implement full SmartArt parsing.' -- **Reality:** SmartArt XML is too complex/non-standard. Rasterization is the practical path.
- **Assumption:** 'pdfjs-dist can extract layout-preserved text.' -- **Reality:** pdfjs-dist is designed for text extraction only, not layout analysis. Python libraries (pymupdf) are far superior.
- **Assumption:** 'Charts are already supported.' -- **Reality:** Charts are locked placeholders. The embedded Excel data (actual numbers) is NOT extracted.
- **Assumption:** 'PDF import should be a single-mode feature.' -- **Reality:** Users expect both editable AND visually-faithful import. Two modes serve different use cases.
- **Assumption:** 'python-pptx is needed for chart enhancement.' -- **Reality:** python-pptx is for CREATING PPTX, not parsing. We can extract embedded xlsx data with custom JS code via JSZip.

## Alternatives Surfaced

**For PPTX charts:**
- A: Custom JS xlsx parser (via JSZip) -- recommended, no new deps
- B: python-pptx server subprocess -- overkill for data extraction only
- C: Rasterize all charts -- loses editability, not recommended

**For PDF import:**
- A: Pure JS with pdfjs-dist -- insufficient layout analysis capability
- B: Server-side Python (pymupdf) -- recommended, far superior text/layout extraction
- C: Third-party OCR API only -- too expensive for volume; ignores structured content

## Next Steps

1. Inspect actual pptxtojson output on a chart-heavy `.pptx` deck to verify the embedded Excel gap
2. Decide: should PDF Python runtime be bundled with Electron or installed separately?
3. Prototype: minimal xlsx parser for chart data extraction (E1 spike -- 2 hours)
4. Evaluate: can existing Playwright raster endpoint handle SmartArt/equations?
5. Plan: create detailed implementation plan for E1 + F1 + F2 + F5 (simplest viable path)
