---
phase: 3
title: "Shadow Extraction from pptxtojson Shadow Object to NavSlides Flat Shadow Fields"
status: pending
priority: P2
effort: ~2h
dependencies: []
---

# Phase 3: Shadow Extraction from pptxtojson Shadow Object to NavSlides Flat Shadow Fields

## Overview

Extract shadow từ pptxtojson output (`element.shadow: {h, v, blur, color}`) và gắn vào NavSlides elements. **CRITICAL: renderer đọc flat fields trên element, không phải nested object.**

## Red Team Fixes Applied
- **[FIX #4]** `extractShadow` phải spread flat fields lên element, KHÔNG gán nested object. Renderer (`element-renderers.js:46-49`) đọc `el.shadowX`, `el.shadowY`, `el.shadowBlur`, `el.shadowColor` là flat fields trên element.
- **[FIX #12]** Success criteria không bao gồm `mapImage()` — pptxtojson không emit shadow trên image elements.

## Context Links
- Research: `plans/reports/researcher-260501-shadow-filters-diagram.md` (Gap 1)
- Mapper: `server/services/pptx-import/mapper.js`
- Types: `shared/src/types/presentation.js` (shadow property on BaseElement at line 30)
- Renderer: `shared/src/element-renderers.js` (`buildBaseStyle` at line 46-49 — reads flat `el.shadowBlur`/`el.shadowX`/`el.shadowY`/`el.shadowColor`)

## Requirements
- Functional: Shadow được preserve trên shape và text elements bằng flat fields
- Non-functional: Renderer đọc flat fields — phải assign flat không phải nested

## Related Code Files
- Modify: `server/services/pptx-import/mapper.js` — extract shadow in mapShape and mapText (inside mapElement)

## Implementation Steps

### 1. Add shadow extraction helper

File: `server/services/pptx-import/mapper.js`, thêm sau các helper functions:

```js
function extractShadow(element) {
  const s = element.shadow
  if (!s || typeof s !== 'object') return null
  return {
    shadowX: typeof s.h === 'number' ? s.h : 0,
    shadowY: typeof s.v === 'number' ? s.v : 0,
    shadowBlur: typeof s.blur === 'number' ? s.blur : 0,
    shadowColor: typeof s.color === 'string' ? s.color : '#000000',
  }
}
```

### 2. Apply shadow in mapShape (inside non-line branch)

File: `server/services/pptx-import/mapper.js`, trong `mapShape()` — tìm non-line branch và thêm vào mapped object **trước return**:

```js
// Trong non-line branch (sau dòng if (textHtml) mapped.textHtml = textHtml, trước return [mapped]):
// [FIX #4] Gán FLAT fields, không phải nested object
const shadow = extractShadow(element)
if (shadow) {
  mapped.shadowX = shadow.shadowX
  mapped.shadowY = shadow.shadowY
  mapped.shadowBlur = shadow.shadowBlur
  mapped.shadowColor = shadow.shadowColor
}
// Rồi return [mapped]
```

### 3. Apply shadow in mapText (inside mapElement)

File: `server/services/pptx-import/mapper.js`, trong `mapElement()` — thêm vào text object trước return:

```js
const text = {
  ...baseElement(element, context.scale, context.zIndex),
  type: 'text',
  content,
  ...extractTextMetadata(content, element),
}
const textInsets = extractTextInsets(element)
if (textInsets) {
  text._pptxImportMeta = { ...(text._pptxImportMeta || {}), textInsets }
}

// [FIX #4] Gán FLAT fields — không phải nested object
const shadow = extractShadow(element)
if (shadow) {
  text.shadowX = shadow.shadowX
  text.shadowY = shadow.shadowY
  text.shadowBlur = shadow.shadowBlur
  text.shadowColor = shadow.shadowColor
}

return [text]
```

## Success Criteria
- [ ] `extractShadow()` extract được `{h, v, blur, color}` → flat `{shadowX, shadowY, shadowBlur, shadowColor}`
- [ ] `mapShape()` gán flat fields lên element (KHÔNG gán nested object)
- [ ] `mapText()` gán flat fields lên element (KHÔNG gán nested object)
- [ ] `mapImage()` — **KHÔNG** extract shadow (pptxtojson không emit shadow trên image) — verify và loại khỏi success criteria

## Risk Assessment
- **Risk:** pptxtojson shadow object format khác với expected → **Mitigation:** `extractShadow` có null check và default values, safe fallback.
- **Risk:** Renderer đọc field names khác → **Mitigation:** Verify element-renderers.js:46-49 reads `shadowBlur`, `shadowX`, `shadowY`, `shadowColor` — đã confirmed.
