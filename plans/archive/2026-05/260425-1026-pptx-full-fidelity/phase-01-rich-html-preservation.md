---
phase: 1
title: "Rich HTML Preservation + PPTX Text Export"
status: complete
priority: P1
effort: "2-3 days"
dependencies: [phase-00-sanitizer-hardening]
---

# Phase 1: Rich HTML Preservation + PPTX Text Export

## Overview

**Revised from plan review.** Keep `element.content` as HTML string (NOT TipTap JSON) for backward compatibility. Improve text extraction from sanitized HTML and enhance PPTX text export to preserve formatting (bold, italic, underline, color, font size, alignment, lists, links).

## Context Links

- Review finding: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md` — P0-A Text Schema
- Phase 0: `phase-00-sanitizer-hardening.md`
- Existing text mapper: `server/services/pptx-import/mapper.js`
- Existing export: `client/src/utils/export-pptx-text-runs.js`
- Existing HTML parser: `client/src/utils/export-pptx-html-parser.js`
- Existing test: `server/services/pptx-import/mapper.test.js`

## Key Insights

After Phase 0, sanitized HTML preserves: `<strong>`, `<em>`, `<b>`, `<i>`, `<u>`, `<s>`, `<strike>`, `<del>`, `<a href>`, `<sub>`, `<sup>`, `<ul>`, `<ol>`, `<li>`, `<br>`, `<p>`, `<span style="color:...">`, `<span style="font-size:...">`, etc.

**Strategy:** Instead of converting HTML → TipTap JSON, we enhance the export-side HTML parser to extract formatting from the sanitized HTML and generate pptxgenjs text runs with full marks.

pptxtojson outputs HTML like:
```html
<p style="text-align:center">
  <span style="font-size:24pt;color:#e74c3c;font-weight:bold;">Hello</span>
  and <em>italic</em> text
</p>
```

Goal: parse this HTML → extract per-run formatting → generate pptxgenjs text runs with text runs array.

## Requirements

**Import side:**
- Preserve sanitized HTML in `element.content` (HTML string — no TipTap JSON)
- Extract text formatting metadata into element fields for editor consumption
- Handle text in both `text` elements AND `shape` elements with text content

**Export side:**
- Enhance `export-pptx-text-runs.js` to parse HTML and generate text runs with:
  - Bold (font weight 700), Italic (font italic), Underline (underline), Strike (strike)
  - Text color (fill: { rgb: ... })
  - Font size (fontSize: N)
  - Font family (typeface: 'name')
  - Text alignment (align: 'center'/'right'/'left')
  - Lists (`bullet: true`, `numbered: true`)
  - Hyperlinks (link: { href: '...' })
  - Subscript/superscript

**Editor consumption:**
- Canvas renders via `dangerouslySetInnerHTML` — already works with sanitized HTML
- Find/replace uses text content — no change needed
- Thumbnails use shared renderer — verify no change needed

## Architecture

**Text run extraction** (`client/src/utils/export-pptx-text-runs.js` — enhanced):
```
HTML string (e.g. '<p style="text-align:center"><strong>Bold</strong></p>')
    ↓ parseHtmlTextRuns(html)
TextRun[]:
  { text: 'Bold', bold: true, fontSize: 14, color: '#000000' }
    ↓ generatePptTextRuns(textRuns)
pptxgenjs text options:
  { options: { bold: true, fontSize: 14, color: '#000000', align: 'center' }, text: 'Bold' }
```

**Implementation approach:** Regex-based HTML parser that walks text nodes and extracts inline styles per run. No DOMParser dependency needed for export-side parsing.

**Per-run extraction rules:**
```
<strong>, <b>, style="font-weight:700/bold" → bold: true
<em>, <i>, style="font-style:italic" → italic: true
<u>, style="text-decoration:underline" → underline: true
<s>, <strike>, <del>, style="text-decoration:line-through" → strike: true
style="color:#RRGGBB" → color: '#RRGGBB'
style="font-size:24pt" → fontSize: 24
style="font-family:Calibri" → typeface: 'Calibri'
style="text-align:center" → align: 'center' (on paragraph)
<a href="..."> → link: { target: '...' }
style="vertical-align:sub" → subscript: true
style="vertical-align:super" → superscript: true
style="letter-spacing:2pt" → charSpacing: N
```

## Related Code Files

**Modify:**
- `server/services/pptx-import/mapper.js` — enhance text element mapping to preserve formatting fields alongside HTML
- `client/src/utils/export-pptx-text-runs.js` — full rewrite to parse HTML and generate pptxgenjs text runs with marks
- `server/services/pptx-import/mapper.test.js` — comprehensive text formatting tests

**No changes needed for:**
- Canvas renderer (uses dangerouslySetInnerHTML — works with sanitized HTML)
- SlideCanvas text rendering (TipTap)
- Find/replace (uses editor.getText())
- Templates (already use HTML)

## Implementation Steps

1. **Enhance `mapText()` in `mapper.js`**
   - Parse sanitized HTML to extract formatting metadata
   - Store: `textAlign`, `fontSize`, `fontFamily`, `textColor` from dominant/paragraph styles
   - Keep HTML in `content` field (canonical)
   - For shape text: apply same approach in `mapShape()`

2. **Rewrite `export-pptx-text-runs.js` — HTML parser**
   - `parseHtmlTextRuns(html: string): TextRun[]` function
   - Parse `<p>/<li>` → paragraph nodes with alignment
   - Parse `<span>` → text runs with inline formatting
   - Extract: bold, italic, underline, strike, color, fontSize, fontFamily, subscript, superscript, letter-spacing
   - Extract: `<ul>/<ol>` → bullet/numbered paragraphs
   - Extract: `<a href>` → hyperlink
   - Flatten nested spans: e.g., `<strong><em>Bold Italic</em></strong>` → single run with both marks
   - Fallback: if parse fails, return plain text run

3. **Update `export-pptx-text-runs.js` — pptxgenjs generation**
   - `generatePptTextRuns(textRuns: TextRun[]): PptxgenText[]` function
   - Map each TextRun to pptxgenjs text run options
   - Handle paragraph alignment from `<p style="text-align:...">`
   - Handle list items (bullets, numbering)
   - Handle hyperlinks (pptxgenjs `link: { href: ... }`)
   - Handle subscript/superscript (pptxgenjs `subscript`, `superscript`)

4. **Update `export-pptx-html-parser.js`** (may need small changes)
   - Verify it handles the enhanced HTML output correctly
   - Ensure backward compat: plain text without HTML tags still works

5. **Add tests in `mapper.test.js`**
   - Test bold/italic preserved through import → export round-trip
   - Test color span preserved
   - Test font size preserved
   - Test paragraph alignment
   - Test bullet list
   - Test hyperlink
   - Test subscript/superscript
   - Test nested formatting (bold+italic+color)
   - Test malformed HTML graceful fallback

## Success Criteria

- [ ] Import PPTX with bold text → edit in editor → bold preserved in export
- [ ] Import PPTX with red colored text → color preserved through round-trip
- [ ] Import PPTX with centered paragraph → alignment preserved
- [ ] Import PPTX with bullet list → `<ul>` → export generates bullet slides
- [ ] Import PPTX with hyperlink → link preserved through round-trip
- [ ] Import PPTX with subscript → subscript preserved
- [ ] Shape text with formatting → same fidelity as text elements
- [ ] All existing tests pass (backward compat with plain text)
- [ ] Performance: < 5ms per text element parsing

## Risk Assessment

**Risk:** Complex nested HTML may not parse perfectly.
**Mitigation:** Regex parser with try/catch fallback to plain text. Test with pptxtojson real output.
**Risk:** Font size format ("24pt") needs parsing — pptxtojson uses pt, pptxgenjs uses pt.
**Mitigation:** Extract numeric value from "24pt" string. Handle both "24pt" and "24" formats.
