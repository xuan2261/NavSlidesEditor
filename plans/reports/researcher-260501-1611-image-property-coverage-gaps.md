# Research Report: PPTX Image/Object Property Coverage Gaps

**Date:** 2026-05-01
**Researcher:** researcher subagent
**Scope:** `server/services/pptx-import/mapper.js`, `geometry.js`, `media.js`, pptxtojson parser output, NavSlides schema, fidelity tester

---

## Summary

The 75-88% image coverage in the fidelity tester is **misleading** — it is primarily a measurement artifact of the tester's coarse image scoring (`src` presence = 1.0). The actual property preservation is strong for geometry/position but has real gaps in: border style (`borderType`/`borderStrokeDasharray`), visual effects (`brightness`/`contrast`/`grayscale`), and crop region unit interpretation. The "other" type (0% coverage, Bai_2_2) is a **known unhandled type**: `math` (equation) elements from pptxtojson that the mapper has no handler for.

---

## 1. mapImage() — Properties Preserved vs. Not Preserved

**File:** `server/services/pptx-import/mapper.js:227-277`

### Preserved (correctly mapped)

| pptxtojson field | NavSlides output field | Notes |
|---|---|---|
| `type: 'image'` | `type: 'image'` | |
| `left`/`top`/`width`/`height` | `x`/`y`/`width`/`height` | via `mapBox()` |
| `rotate` | `rotation` | via `baseElement()` |
| `opacity` | `opacity` | via `baseElement()` |
| `isFlipH` | `flipH` | |
| `isFlipV` | `flipV` | |
| `borderColor` | `borderColor` | |
| `borderWidth` | `borderWidth` | |
| `geom` | `objectFit = 'cover'` | only if `geom === 'picture'` |
| `fill.mode/fit` | `objectFit` (contain/fill/stretch) | |
| `alt`/`title`/`descr`/`description` | `alt` | via `plainText()` |
| `rect.l/r/t/b` | `imageW`/`imageH`/`imageOffsetX`/`imageOffsetY` | partial — see below |
| `base64`/`blob`/`ref` | `src` (file path) | via `persistImageForElement()` |

### NOT Preserved

| pptxtojson field | Impact | Severity |
|---|---|---|
| `borderType` (solid/dashed/dotted/...) | CSS border-style not set; dashed borders render as solid | Low |
| `borderStrokeDasharray` (e.g. "4 2") | Actual dash pattern lost | Low |
| `rect` crop unit mismatch | Bai_2_5 has rect values like `{l:1.474}`, not in 0-1000 range; dividing by 1000 gives ~0 — crop silently ignored | **High** |
| Visual effects: `effect`/`shadow`/`reflection`/`softEdges`/`brightness`/`contrast`/`colorOverlay`/`tone`/`saturation` | Not present in corpus but defined in pptx spec | Medium |
| `filterBrightness`/`filterContrast`/`filterGrayscale` | Supported in `element-renderers.js:80-86` but mapper never extracts from PPTX source | Medium |
| `borderRadius` | Supported in `element-renderers.js:51` and schema but mapper never sets it | Low |
| Linked images (`blip`, `link` to external URL) | Only `base64`/`blob`/`ref` checked; if PPTX stores link-only image, may not be extracted | Low |

---

## 2. The rect Crop Unit Mismatch (Critical Gap)

**Evidence:** pptxtojson outputs from Bai_2_5 show:
```json
{ "l": 1.474 }
{ "l": 2.589 }
{ "b": 12.267, "l": 22.275, "r": 20.324 }
{ "t": 2.187 }
```

**Code in `mapper.js:258-275`:**
```js
const left = Math.min(1, Math.max(0, readNumber(element.rect.l, 0) / 1000))
// readNumber(1.474, 0) / 1000 = 0.001474 → near-zero crop → ignored
```

The division by 1000 assumes the value is in 0–1000 range (integers representing 0.0–1.0 fraction in thousandths). But pptxtojson may be outputting values already as percentages (0–100) or fractions (0.0–1.0). The values `1.474`, `22.275`, `12.267` suggest **percentages** (e.g., 22.275% left crop), not fractions. Dividing by 1000 makes all crops zero.

**Result:** Crop regions with any non-trivial values are silently discarded. The 6 images in Bai_2_5 that have `rect` properties (out of 25 total) lose their cropping.

---

## 3. borderType and borderStrokeDasharray — Style Not Preserved

**Code in `mapper.js:254-256`:**
```js
if (element.borderColor) img.borderColor = element.borderColor
if (readNumber(element.borderWidth, 0) > 0) img.borderWidth = readNumber(element.borderWidth, 0)
```

pptxtojson provides `borderType` and `borderStrokeDasharray` (confirmed across all 4 corpus files). Neither is mapped. `element-renderers.js` does not use these for image elements — it only renders a CSS `border` via the `style` variable which is built from `borderColor` and `borderWidth` only. No `borderStyle` is included.

---

## 4. NavSlides ImageElement Schema vs. What mapImage() Produces

**Schema (`shared/src/types/presentation.js:40-51`):**
```js
@typedef {BaseElement & {
  src: string,
  objectFit?: 'cover'|'contain'|'fill',
  cropX?: number,
  cropY?: number,
  cropWidth?: number,
  cropHeight?: number,   // ← defined in schema
  brightness?: number,   // ← defined in schema
  contrast?: number,     // ← defined in schema
  grayscale?: number,    // ← defined in schema
  borderRadius?: number  // ← defined in schema
}} ImageElement
```

**What mapper actually produces:**
```js
{
  type: 'image',
  id: uuid,
  x, y, width, height,
  rotation, opacity, zIndex,
  src: '/uploads/xxx.png',
  objectFit: 'contain' | 'cover' | 'fill',
  alt: plainText(...),
  flipH: boolean,
  flipV: boolean,
  borderColor: string,
  borderWidth: number,
  imageW: number,       // internal crop model
  imageH: number,       // internal crop model
  imageOffsetX: number, // internal crop model
  imageOffsetY: number, // internal crop model
  _pptxImportMeta: { cropData: { top, bottom, left, right } }
}
```

**Schema properties NOT set by mapper:** `brightness`, `contrast`, `grayscale`, `borderRadius`. `cropX/Y/Width/Height` also not set — mapper uses an alternative internal model (`imageW/H/offsetX/Y`).

---

## 5. Why the Fidelity Tester Shows 75-88% (Measurement Artifact)

**File:** `pptx-import-semantic-and-roundtrip-fidelity-tester.js:549-554`
```js
if (type === 'image') {
  const score = navEl.src ? 1 : 0.1
  if (!navEl.src) gaps.push('missing-image-src')
  if (navEl.objectFit) gaps.push('preserved-objectFit')  // ← ALWAYS adds gap
  return { score, gaps }
}
```

The image evaluator gives **score = 1.0 if `src` exists**, regardless of how many properties are preserved. `objectFit` presence always produces a gap label (misleadingly suggesting objectFit is not preserved when it actually is). The 75-88% per-file score is driven entirely by **element count matching** (19/24 images matched for Bai_2_1 = 79% image count match, not property coverage). This is a tester design issue, not a real property gap for basic images.

---

## 6. The "Other" Type (0% Coverage) — Math Elements

**Source:** `mapper.js:457-496` has no handler for `type === 'math'`.

**Evidence from Bai_2_2 pptxtojson output:**
```
Total math elements: 4
Keys per math element: type, top, left, width, height, latex, picRef, picBase64, picBlob, text, order
```

pptxtojson parses Office Math ML (OMML) equations into `type: 'math'` elements with `latex` source and a rasterized `picBase64` fallback. These fall through to:
```js
return [placeholder(element, ..., 'unknown-object', 'Unsupported PPTX object locked as placeholder')]
```

The fidelity tester's `mapCategory()` also does not recognize `math`:
```js
// mapCategory() — no 'math' case → return 'other'
// → 4 elements scored as 'other' with score 0.5 (unknown-type fallback)
```

The fidelity score of 0% for "other" is because `evaluateCapture()` has no `type === 'other'` handler, so it uses the generic fallback `score = 0.5` per matched element. Since the math elements are not matched (they become placeholders), `coverageByType['other'].total` counts 4 unmatched, driving coverage to 0%.

**Root cause:** Two bugs:
1. `mapCategory()` should map `'math'` → `'image'` (math is rendered as an image in pptxtojson via `picBase64`)
2. The mapper should handle `type === 'math'` by converting it to an image using the `picBase64` data

---

## 7. Element Count Mismatches (Bai_2_1: 24 source → 19 nav)

The 5 unmatched images in Bai_2_1 are likely:
- Images inside groups that got flattened and their coordinates transformed, causing the semantic matcher to fail to find a close-enough match
- The geometry drift for images is low (0.5px median) but the semantic matcher uses combined x/y/width/height distance; group transforms can shift positions enough to exceed the matching threshold

---

## 8. media.js — Image Extraction Completeness

**File:** `server/services/pptx-import/media.js:52-65`

```js
function getElementImagePayload(element) {
  const candidates = [
    element?.base64,
    element?.src,
    element?.blob,
    element?.fill?.value?.base64,
    element?.fill?.value?.blob,
  ]
  // ...
}
```

pptxtojson image elements have `base64` (EMF/WMF/PNG in data URI format), `blob` (empty string), and `ref` (media path). The `fill.value.base64` check is irrelevant for image elements (fill is null). The `ref` path is handled separately via `persistZipMediaRef()`. Image extraction is complete for embedded images.

**Not handled:** linked/external images referenced only by blip URL (not embedded in the PPTX zip). This is a theoretical edge case.

---

## Key Questions Answered

**Which specific image properties are NOT being mapped?**
1. `borderType` — CSS border-style not applied
2. `borderStrokeDasharray` — dashed border pattern not applied
3. `rect` crop values — unit mismatch causes values to be silently discarded
4. Visual effects (shadow, reflection, softEdges, brightness, contrast, colorOverlay) — not in corpus but would be lost
5. `brightness`/`contrast`/`grayscale` — supported by renderer but never extracted

**What does pptxtojson provide that we ignore?**
`borderType`, `borderStrokeDasharray`, and potentially `rect` values (if unit were fixed).

**What does the NavSlides schema expect vs. what we provide?**
Schema defines `brightness`, `contrast`, `grayscale`, `borderRadius`, `cropX/Y/Width/Height`. Mapper produces an internal crop model (`imageW/H/offsetX/Y` + `_pptxImportMeta.cropData`) and does not set brightness/contrast/grayscale/borderRadius.

**Is the issue in the parsing step or the mapping step?**
Mapping step. Parser (pptxtojson) produces all fields. The mapper discards `borderType`/`borderStrokeDasharray`/`rect` unit and does not extract effect fields.

**Image sub-types (embedded vs linked, different formats)?**
All corpus images are embedded (base64). Linked external images are not tested. EMF/WMF images (Bai_2_1/2_2) are rendered as EMF data URIs and stored as PNG after persist — no quality loss detected.

---

## Unresolved Questions

1. What are the correct units for `rect` values in pptxtojson? Are they 0-1000 integers, 0-100 percentages, or 0.0-1.0 fractions? Need to verify against the pptxtojson source code.
2. Do any PPTX files in the corpus have `effect`/`shadow`/`brightness`/`contrast` properties on images? None in current corpus, but would be lost if encountered.
3. The fidelity tester's image `evaluateCapture()` always adds a `preserved-objectFit` gap — is this intentional or a bug in the tester?
