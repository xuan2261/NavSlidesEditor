---
phase: 2
title: "Math LaTeX Import"
status: pending
priority: P1
effort: ~2h
dependencies: []
---

# Phase 2: Math LaTeX Import

## Overview

Fix `mapMath()` trong mapper để tạo `type: 'latex'` element (editable LaTeX) thay vì chỉ convert sang image. pptxtojson parse OMML → clean LaTeX string trong `element.latex`.

## Red Team Fixes Applied
- **[FIX #5]** Stats init `mathCount: 0` — phải thêm vào `mapPptxOutput()` stats object (đã có ở Phase 1, verify ở đây)
- **[FIX #13]** `renderLatex` không đọc `_fallbackSrc` — phải modify renderer để catch KaTeX error và fallback sang image
- **[FIX #15]** Bỏ `<[^>]+>` regex stripping — `latexFormart` đã decode entities rồi

## Context Links
- Research: `plans/reports/researcher-260501-video-audio-math.md` (Gap 2)
- Mapper: `server/services/pptx-import/mapper.js` (hiện lines ~495-501)
- Types: `shared/src/types/presentation.js` (latex element)
- Renderer: `shared/src/element-renderers.js` (`renderLatex` at line 206)
- Stats: `mapper.js:700` (verify `mathCount` đã được thêm ở Phase 1)

## Requirements
- Functional: Math equation từ PPTX được giữ LaTeX string để editable trong NavSlides
- Non-functional: KaTeX render fail → fallback image được show

## Related Code Files
- Modify: `server/services/pptx-import/mapper.js` — replace math fallback logic
- Modify: `shared/src/element-renderers.js` — add try-catch fallback in `renderLatex`

## Implementation Steps

### 1. Replace mapMath logic in mapper.js

File: `server/services/pptx-import/mapper.js`, thay thế đoạn hiện tại (lines ~495-501):

```js
// TRƯỚC (chỉ giữ image, mất LaTeX):
if (element.type === 'math') {
  if (element.picBase64) {
    const mathEl = { ...element, type: 'image', base64: element.picBase64 }
    return mapImage(mathEl, context)
  }
  return [placeholder(...)]
}

// SAU:
if (element.type === 'math') {
  const latex = element.latex || element.text || ''
  if (!latex) {
    // No LaTeX text — fallback to image
    if (element.picBase64) {
      const mathEl = { ...element, type: 'image', base64: element.picBase64 }
      return mapImage(mathEl, context)
    }
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'math', 'Math equation')]
  }
  // [FIX #15] KHÔNG strip tags — latexFormart đã decode entities &lt;/&gt; rồi
  // Chỉ strip XML-like tags nếu có
  const cleanLatex = latex.replace(/<[a-z][^>]*>/gi, '').trim()
  if (!cleanLatex) {
    if (element.picBase64) {
      const mathEl = { ...element, type: 'image', base64: element.picBase64 }
      return mapImage(mathEl, context)
    }
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'math', 'Math equation')]
  }
  context.stats.mathCount = (context.stats.mathCount || 0) + 1
  return [{
    ...baseElement(element, context.scale, context.zIndex),
    type: 'latex',
    // [FIX #13] renderLatex reads el.content (element-renderers.js:207)
    content: cleanLatex,
    // Schema expects 'latex' field too (types/presentation.js:74-77)
    latex: cleanLatex,
    // Preserve PNG fallback for rendering failures
    _fallbackSrc: element.picBase64 || null,
  }]
}
```

### 2. Modify renderLatex to handle KaTeX errors and fallback to image

File: `shared/src/element-renderers.js`, trong `renderLatex()` — wrap KaTeX rendering để catch errors:

```js
function renderLatex(el, style, wrap, vis, opts) {
  const content = el.content || ''
  const hasTikz = /\\begin\{tikzpicture\}/.test(content)

  if (opts.forPrint) {
    // ...existing print handling...
  }

  const _origin = getAssetOrigin()

  // [FIX #13] Wrap KaTeX rendering to fallback to image on error
  let katexOk = false
  let katexHtml = ''
  try {
    katexHtml = katex.renderToString(content, { displayMode: false, throwOnError: false })
    katexOk = true
  } catch (e) {
    katexHtml = ''
  }

  if (!katexOk && el._fallbackSrc) {
    // KaTeX failed + we have PNG fallback — show image instead
    const fallbackSrc = absoluteSrc(el._fallbackSrc)
    return `<div${wrap} style="${style}${vis}"><img src="${fallbackSrc}" alt="Math equation" style="display:block;width:100%;height:100%;object-fit:contain;" /></div>`
  }

  // ...rest of existing renderLatex code...
}
```

## Success Criteria
- [ ] `type: 'math'` → `type: 'latex'` element với `content` + `latex` field
- [ ] `picBase64` được giữ trong `_fallbackSrc`
- [ ] KaTeX render fail → fallback image được show
- [ ] Empty LaTeX string → fallback image hoặc placeholder
- [ ] `mathCount` stats tracking (verify đã thêm ở Phase 1)

## Risk Assessment
- **Risk:** pptxtojson LaTeX format không tương thích với KaTeX → **Mitigation:** `_fallbackSrc` PNG luôn available như fallback cuối cùng.
- **Risk:** `renderLatex` modification có thể break existing LaTeX rendering → **Mitigation:** Chỉ catch error và fallback khi có `_fallbackSrc`, ngược lại giữ behavior cũ.
