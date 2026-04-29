---
phase: 0
title: "Schema Compatibility + Sanitizer Hardening"
status: complete
priority: P0
effort: "0.5-1 day"
dependencies: []
---

# Phase 0: Schema Compatibility + Sanitizer Hardening

## Overview

**P0 Blocker.** Critical fixes that must be done BEFORE any content processing phases. This phase addresses two critical issues: (1) the sanitizer strips formatting before content is even seen, and (2) the mapper needs an array-return contract for group flattening.

## Context Links

- Review: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md`
- Existing sanitizer: `server/services/pptx-import/sanitize.js`
- Existing mapper: `server/services/pptx-import/mapper.js`
- Schema types: `shared/src/types/presentation.js`
- Existing test: `server/services/pptx-import/mapper.test.js`

## Requirements

**P0-A: Sanitizer Hardening**

Current sanitizer strips these before any converter sees them:
- `text-decoration` (underline, strikethrough)
- `vertical-align` (subscript, superscript)
- `letter-spacing` (character spacing)
- `text-shadow`
- `<a href>` links (no href in ALLOWED_ATTR)
- `<s>/<strike>/<del>` tags

**P0-B: Mapper Array Return Contract**

`mapElement()` currently returns a single element. Group flattening (Phase 6) needs it to return an array. This contract change must be done now so all subsequent phases build on the correct contract.

## Architecture

**Sanitizer changes** (`server/services/pptx-import/sanitize.js`):
```js
// BEFORE
const SAFE_STYLE_PROPS = new Set([
  'color', 'font-family', 'font-size', 'font-style',
  'font-weight', 'text-align',
])
const ALLOWED_ATTR = ['style']

// AFTER
const SAFE_STYLE_PROPS = new Set([
  'color', 'font-family', 'font-size', 'font-style',
  'font-weight', 'text-align',
  'text-decoration', 'vertical-align',       // NEW
  'letter-spacing', 'text-shadow',           // NEW
  'background',                              // NEW (for highlight)
])
const ALLOWED_TAGS = [
  'p', 'span', 'strong', 'em', 'b', 'i', 'u',
  'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3',
  'a',                                        // NEW
  's', 'strike', 'del',                      // NEW
  'sub', 'sup',                              // NEW (subscript/superscript)
]
const ALLOWED_ATTR = [
  'style',
  'href',                                     // NEW: with protocol validation
]

// Protocol whitelist for href
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:']
```

**Mapper contract change** (`server/services/pptx-import/mapper.js`):
```js
// BEFORE
const mapped = await mapElement(element, context)
elements.push(mapped)

// AFTER
const results = await mapElement(element, context)  // always returns array
for (const result of results) {
  if (result.importPlaceholderType) stats.placeholderCount++
  elements.push(result)
}
```

## Related Code Files

**Modify:**
- `server/services/pptx-import/sanitize.js` — extend SAFE_STYLE_PROPS, ALLOWED_TAGS, ALLOWED_ATTR, add protocol validation
- `server/services/pptx-import/mapper.js` — change `mapElement()` return type to array, update all callers
- `server/services/pptx-import/mapper.test.js` — add sanitizer security tests

## Implementation Steps

1. **Update `sanitize.js` — extend `SAFE_STYLE_PROPS`**
   - Add: `text-decoration`, `vertical-align`, `letter-spacing`, `text-shadow`, `background`
   - Add URL validation for style values: `url(...)` only for `background`, must pass protocol whitelist

2. **Update `sanitize.js` — add missing tags**
   - Add: `<a>`, `<s>`, `<strike>`, `<del>`, `<sub>`, `<sup>`
   - Strip `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`

3. **Update `sanitize.js` — add href attribute with protocol validation**
   - Allow `href` attribute on `<a>` tags only
   - Validate: `href.match(/^(https?:|mailto:|tel:)/)` — reject javascript:, data:, vbscript:
   - Strip `onclick`, `onmouseover`, and all other event handlers even if present

4. **Update `mapper.js` — change `mapElement()` return contract**
   - Change return type: all handlers return `Promise<Element[]>` (array)
   - `mapImage()` → `return [result]` or `[placeholder]`
   - `mapTable()` → `return [result]` or `[placeholder]`
   - `mapShape()` → `return [result]`
   - `mapText()` → `return [result]`
   - `mapGroup()` → `return [flattened children]` (for now, placeholder until Phase 6)
   - Update loop: `for (const result of await mapElement(...))`
   - Update `placeholderCount` increment: check inside loop per element
   - Update zIndex: increment per result in flattened array

5. **Verify backward compatibility**
   - All existing `mapper.test.js` tests pass
   - Run `npm run test -- server/services/pptx-import/mapper.test.js`

6. **Add security regression tests in `mapper.test.js`**
   - Test: `<a href="javascript:alert(1)">` → stripped
   - Test: `<a href="https://safe.com">` → preserved
   - Test: `<s>strikethrough</s>` → preserved
   - Test: `<sub>subscript</sub>` → preserved
   - Test: `<span style="text-decoration:underline">` → preserved
   - Test: `<span style="letter-spacing:2pt">` → preserved

## Success Criteria

- [ ] `<a href="https://example.com">` survives sanitization with href preserved
- [ ] `<s>strikethrough</s>` and `<del>deleted</del>` survive
- [ ] `<sub>subscript</sub>` and `<sup>superscript</sup>` survive
- [ ] `<span style="text-decoration:underline">` survives with style preserved
- [ ] `<span style="letter-spacing:1pt">` survives with style preserved
- [ ] `<a href="javascript:bad()">` → href stripped
- [ ] `<a href="data:evil">` → href stripped
- [ ] `mapElement()` returns array for all element types
- [ ] zIndex increments correctly for array-returning handlers
- [ ] All existing mapper tests pass (backward compat)

## Risk Assessment

**Risk:** Adding `href` to sanitizer opens XSS surface if protocol validation is incomplete.
**Mitigation:** Strict protocol whitelist (https:, http:, mailto:, tel:). No `data:` URIs. No `javascript:`. All event handler attributes stripped regardless.
**Risk:** Array return contract change breaks all existing element handlers.
**Mitigation:** Update each handler systematically. Add integration test that iterates all element types.
