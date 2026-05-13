# Research Report: Video/Audio Import & Math LaTeX Import Gaps

**Author:** researcher agent
**Date:** 2026-05-01
**Project:** NavSlides PPTX Import
**Files in scope:** `server/services/pptx-import/parse-worker.js`, `server/services/pptx-import/media.js`, `server/services/pptx-import/mapper.js`, `shared/src/types/presentation.js`, `shared/src/element-renderers.js`

---

## GAP 1: Video/Audio Import (Completely Missing)

### Current State

`parse-worker.js` line 41-45 sets both modes to `'none'`:

```js
const output = await parse(toArrayBuffer(buffer), {
  imageMode: 'base64',
  videoMode: 'none',   // <-- disabled
  audioMode: 'none',    // <-- disabled
})
```

`mapper.js` has no handler for `element.type === 'video'` or `element.type === 'audio'`. These fall through to the final `placeholder()` at line 520:

```js
return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'unknown-object', 'Unsupported PPTX object locked as placeholder')]
```

`media.js` has no function to persist video/audio binary data to disk. It only handles images.

---

### What pptxtojson Produces for Video/Audio

From `node_modules/pptxtojson/src/pptxtojson.js` (`processPicNode`, lines 939-977) and `fill.js` (`loadMedia`):

**Element shape (from `.d.ts`):**

```ts
interface Video {
  type: 'video'
  left: number; top: number; width: number; height: number
  ref: string   // e.g. "ppt/media/video.mp4"
  blob: string  // blob: URL or ''
  order: number
}
interface Audio {
  type: 'audio'
  left: number; top: number; width: number; height: number
  ref: string   // e.g. "ppt/media/audio.mp3"
  blob: string  // blob: URL or ''
  order: number
}
```

**Critical: `blob` field is a browser-only `blob:` URL** — `fill.js` line 76-78:

```js
cacheItem.blob = URL.createObjectURL(new Blob([arrayBuffer], mimeType ? { type: mimeType } : undefined))
```

`URL.createObjectURL` is a browser Web API. In Node.js (where parse-worker runs), it is `undefined` or throws. So `blob` will always be `''` in the current Node.js worker — the field is useless as-is.

**Supported formats** (`pptxtojson.js` lines 900, 928):
- Video: `mp4`, `webm`, `ogg` only
- Audio: `mp3`, `wav`, `ogg` only

Unsupported formats get `{ ref: filename, blob: '' }` — no data extracted.

`ref` is always the path inside the ZIP (e.g. `ppt/media/media7.mp4`), which can be used to extract raw bytes via the zip.

---

### What's Missing

1. `parse-worker.js` must change `videoMode`/`audioMode` to `'blob'` so pptxtojson actually attempts extraction.
2. `media.js` needs a `persistMediaBuffer(blob, ext, uploadsDir)` function that takes raw bytes + extension and writes a file.
3. `mapper.js` needs `mapVideo()` and `mapAudio()` functions that:
   - Extract the media binary from the ZIP via `mediaIndex` using `element.ref`
   - Detect MIME type from extension
   - Persist to `uploadsDir`
   - Return a `VideoElement` or `AudioElement` with `src: '/uploads/filename.ext'`
4. `mapElement()` must dispatch `element.type === 'video'/'audio'` to the new handlers.

NavSlides schema (`types/presentation.js`):

```ts
VideoElement: { src: string, autoplay?: boolean, loop?: boolean, muted?: boolean }
AudioElement: { src: string, autoplay?: boolean, loop?: boolean }
```

---

### Code Changes Needed

**File 1: `server/services/pptx-import/media.js`**

Add a MIME extension map and `persistMediaBuffer`:

```js
// Add to top-level MIME_EXTENSIONS map:
['video/mp4', 'mp4'],
['video/webm', 'webm'],
['video/ogg', 'ogv'],
['audio/mpeg', 'mp3'],
['audio/wav', 'wav'],
['audio/ogg', 'ogg'],

// Add function:
const VIDEO_EXTENSIONS = new Map([
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['ogg', 'video/ogg'],
  ['ogv', 'video/ogg'],
])
const AUDIO_EXTENSIONS = new Map([
  ['mp3', 'audio/mpeg'],
  ['wav', 'audio/wav'],
  ['ogg', 'audio/ogg'],
])

async function persistMediaFromZip(mediaIndex, ref, uploadsDir = UPLOADS_DIR) {
  const normalized = String(ref || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const entry = mediaIndex.files.get(normalized)
  if (!entry) return null
  const buffer = await entry.async('nodebuffer')
  const ext = normalized.split('.').pop().toLowerCase()
  const mime =
    VIDEO_EXTENSIONS.get(ext) ||
    AUDIO_EXTENSIONS.get(ext) ||
    'application/octet-stream'
  return persistMediaBuffer(buffer, mime, uploadsDir)
}

async function persistMediaBuffer(buffer, mime, uploadsDir = UPLOADS_DIR) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return null
  const ext = [...VIDEO_EXTENSIONS.values(), ...AUDIO_EXTENSIONS.values()]
    .reduce((m, v) => { m.set(v.split('/')[1], v); return m }, new Map())
    .get(mime.split('/')[1]) ? mime.split('/')[1] : 'bin'
  await fs.ensureDir(uploadsDir)
  const filename = `${uuidv4()}.${ext}`
  await fs.writeFile(path.join(uploadsDir, filename), buffer)
  return `/uploads/${filename}`
}
```

**File 2: `server/services/pptx-import/parse-worker.js`**

```js
// Line 41-45 — change:
const output = await parse(toArrayBuffer(buffer), {
  imageMode: 'base64',
  videoMode: 'blob',   // was 'none'
  audioMode: 'blob',   // was 'none'
})
```

**File 3: `server/services/pptx-import/mapper.js`**

Export `persistMediaFromZip` from `media.js`:

```js
// top of mapper.js, update the import:
const { createMediaIndex, persistImageForElement, persistMediaFromZip } = require('./media')
```

Add `mapVideo` and `mapAudio` functions, then add cases to `mapElement`:

```js
async function mapVideo(element, context) {
  const src = await persistMediaFromZip(context.mediaIndex, element.ref, context.uploadsDir)
  if (!src) {
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex,
      context.warnings, 'media-missing', 'Video media unavailable')]
  }
  context.stats.videoCount = (context.stats.videoCount || 0) + 1
  const box = mapBox(element, context.scale)
  return [{
    ...baseElement(element, context.scale, context.zIndex, box),
    type: 'video',
    src,
    autoplay: false,
    loop: false,
    muted: false,
  }]
}

async function mapAudio(element, context) {
  const src = await persistMediaFromZip(context.mediaIndex, element.ref, context.uploadsDir)
  if (!src) {
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex,
      context.warnings, 'media-missing', 'Audio media unavailable')]
  }
  context.stats.audioCount = (context.stats.audioCount || 0) + 1
  const box = mapBox(element, context.scale)
  return [{
    ...baseElement(element, context.scale, context.zIndex, box),
    type: 'audio',
    src,
    autoplay: false,
    loop: false,
  }]
}
```

Add to `mapElement()` before the final placeholder:

```js
// after line 493 (chart handler), before math handler:
if (element.type === 'video') return mapVideo(element, context)
if (element.type === 'audio') return mapAudio(element, context)
```

Initialize new stats fields in `mapPptxOutput`:

```js
const stats = { textCount: 0, imageCount: 0, shapeCount: 0, tableCount: 0,
  chartCount: 0, videoCount: 0, audioCount: 0, placeholderCount: 0 }
```

---

### Limitations & Risks

- **Format whitelist**: pptxtojson only extracts `mp4/webm/ogg/mp3/wav/ogg`. AVI, WMV, M4A, FLAC, etc. will produce `{ ref, blob: '' }` and fall back to placeholder. No way to extend this without patching pptxtojson.
- **Blob URLs are browser-only**: `element.blob` from pptxtojson is always `''` in Node.js. The fix uses `element.ref` + ZIP extraction instead.
- **Autoplay/loop/muted lost**: PPTX stores `<a:videoFile>` with `showWhenEmbedded` etc. but pptxtojson does not expose these. The mapped element defaults to `autoplay: false, loop: false, muted: false`.
- **External links**: If a video/audio is linked externally (`isVideoLink = true`), `blob` is `''` and `ref` is the URL string. `persistMediaFromZip` will get a null entry and return placeholder. Could add a special case to use the URL directly.
- **Memory**: Large video files extracted to disk — no streaming. Acceptable for typical PPTX media (< 100 MB).

### Effort Estimation: **MEDIUM**
- New file functions in `media.js` (~30 lines)
- `parse-worker.js`: 2-line change
- `mapper.js`: ~60 lines new functions + 2 dispatch lines + 1 stats line

---

## GAP 2: Math LaTeX Import (LaTeX String Lost, Only Image Kept)

### Current State

`mapper.js` lines 495-501:

```js
if (element.type === 'math') {
  if (element.picBase64) {
    const mathEl = { ...element, type: 'image', base64: element.picBase64 }
    return mapImage(mathEl, context)   // converts to image element — LaTeX LOST
  }
  return [placeholder(...)]  // if no picBase64, shows placeholder
}
```

When `picBase64` exists, the entire math element is converted to an `image` type. The actual LaTeX source string (`element.latex`) is discarded. When `picBase64` is absent, a placeholder is shown. In neither case does a proper `latex` element get created.

---

### What pptxtojson Produces for Math

From `pptxtojson/src/pptxtojson.js` (`processMathNode`, lines 551-585):

```ts
interface Math {
  type: 'math'
  left: number; top: number; width: number; height: number
  latex: string        // LaTeX source string (e.g. "\\frac{x}{y}")
  picRef: string       // path inside ZIP (e.g. "ppt/media/img1.png")
  picBase64: string    // data:image/png;base64,...  (fallback raster image)
  picBlob: string      // blob: URL (browser-only, always '' in Node)
  text?: string        // HTML text content from the equation text box
  order: number
}
```

**The `latex` field is a clean LaTeX string** — pptxtojson parses Office Math ML (OMML) into LaTeX via `src/math.js`. The parser handles:

| OMML construct | LaTeX output |
|---|---|
| `m:f` (fraction) | `\frac{numerator}{denominator}` |
| `m:sSup` (superscript) | `base^{sup}` |
| `m:sSub` (subscript) | `base_{sub}` |
| `m:rad` (radical) | `\sqrt[deg]{expr}` or `\sqrt{expr}` |
| `m:nary` (n-ary) | `\int_{sub}^{sup}{e}`, `\sum_{sub}^{sup}{e}`, etc. |
| `m:limLow`/`m:limUpp` | limits |
| `m:d` (delimiter) | `\left( ... \right)` |
| `m:func` (function) | `\func{arg}` |
| `m:groupChr` | accent characters |
| `m:eqArr` | `\begin{cases} ... \end{cases}` |
| `m:bar` | `\overline{e}` / `\underline{e}` |
| `m:acc` | `\hat{e}`, `\tilde{e}`, etc. (all LaTeX accent commands) |
| `m:borderBox` | `\boxed{e}` |
| `m:m` (matrix) | `\begin{matrix} ... \end{matrix}` |
| `m:t` (text run) | raw text |

Then `latexFormart()` un-escapes HTML entities (lines 178-183):
```js
export function latexFormart(latex) {
  return latex
    .replaceAll(/&lt;/g, '<')
    .replaceAll(/&gt;/g, '>')
    .replaceAll(/&amp;/g, '&')
    .replaceAll(/&apos;/g, "'")
    .replaceAll(/&quot;/g, '"')
}
```

So the `latex` field is a well-formed LaTeX string ready for KaTeX or TikZ.

---

### NavSlides LatexElement Schema

From `shared/src/types/presentation.js`:

```ts
LatexElement: {
  latex: string,       // LaTeX source
  displayMode?: boolean
}
```

From `shared/src/element-renderers.js` (`renderLatex`, lines 206-231):

```js
function renderLatex(el, style, wrap, vis, opts) {
  const content = el.content || ''          // used if present
  const hasTikz = /\\begin\{tikzpicture\}/.test(content)

  if (hasTikz) {
    // Uses tikzjax — \begin{tikzpicture} ... \end{tikzpicture} blocks
    bodyContent = `<script type="text/tikz">${content}</script>`
  } else {
    // Uses KaTeX — renders the string
    bodyContent = `<div id="m"></div><script>try{katex.render(${JSON.stringify(content)},...)}catch(e){...}</script>`
  }
}
```

**Key issue**: `renderLatex` reads `el.content`, not `el.latex`. If `content` is empty, KaTeX renders an empty div (error). The NavSlides `LatexElement` type stores the LaTeX in `el.latex`, but the renderer checks `el.content` first.

Workaround: set both `latex` (for type compliance) and `content` (for renderer compatibility):

```js
{
  type: 'latex',
  latex: element.latex,   // primary source
  content: element.latex, // for renderLatex compatibility
  displayMode: true,
}
```

---

### What's Missing

The `mapMath` function (or inline in `mapElement`) must:
1. Use `element.latex` as the LaTeX source (not discard it).
2. Create a `LatexElement` with `latex` and `content` fields.
3. Optionally preserve `picBase64` as a fallback image in `_fallbackSrc` (for rendering failures).
4. Set `displayMode: true` (equations in presentations are display math).

---

### Code Changes Needed

**File: `server/services/pptx-import/mapper.js`**

Replace the `if (element.type === 'math')` block in `mapElement()` (lines 495-501):

```js
// OLD (discards LaTeX, converts to image):
if (element.type === 'math') {
  if (element.picBase64) {
    const mathEl = { ...element, type: 'image', base64: element.picBase64 }
    return mapImage(mathEl, context)
  }
  return [placeholder(...)
}

// NEW:
if (element.type === 'math') {
  context.stats.mathCount = (context.stats.mathCount || 0) + 1
  const box = mapBox(element, context.scale)
  const latex = typeof element.latex === 'string' ? element.latex.trim() : ''

  if (!latex) {
    // No LaTeX source — fall back to image if picBase64 exists
    if (element.picBase64) {
      const mathEl = { ...element, type: 'image', base64: element.picBase64 }
      return mapImage(mathEl, context)
    }
    return [placeholder(element, context.scale, context.zIndex,
      context.slideIndex, context.warnings, 'math', 'Math equation')]
  }

  // Persist the fallback PNG if available (used if KaTeX/TikZ rendering fails)
  let fallbackSrc = null
  if (element.picBase64) {
    fallbackSrc = await persistImageForElement(
      { base64: element.picBase64 },
      context.mediaIndex,
      context.uploadsDir
    )
  }

  const mathEl = {
    ...baseElement(element, context.scale, context.zIndex, box),
    type: 'latex',
    latex,
    content: latex,         // renderLatex reads el.content
    displayMode: true,
  }
  if (fallbackSrc) mathEl._fallbackSrc = fallbackSrc
  return [mathEl]
}
```

Also add `mathCount` to stats in `mapPptxOutput`:

```js
const stats = { textCount: 0, imageCount: 0, shapeCount: 0, tableCount: 0,
  chartCount: 0, videoCount: 0, audioCount: 0, mathCount: 0, placeholderCount: 0 }
```

**Optional: Update `renderLatex` in `shared/src/element-renderers.js`** to handle `_fallbackSrc` on render failure. This is a nice-to-have — the fallback PNG would only show if KaTeX rendering throws. Currently the catch block shows `e.message` in plain text. To use the fallback:

```js
// inside renderLatex, in the catch block — modify:
} catch(e) {
  const fb = el._fallbackSrc
    ? `<img src="${absoluteSrc(el._fallbackSrc)}" style="max-width:100%;max-height:100%;object-fit:contain;" />`
    : e.message
  document.getElementById('m').innerHTML = fb
}
```

---

### Compatibility Analysis

pptxtojson LaTeX output → NavSlides KaTeX renderer:

| Feature | pptxtojson | KaTeX | Compatible |
|---|---|---|---|
| Fractions | `\frac{a}{b}` | `\frac{a}{b}` | YES |
| Superscript/subscript | `^{x}`, `_{y}` | `^{x}`, `_{y}` | YES |
| Square root | `\sqrt{x}` | `\sqrt{x}` | YES |
| Nth root | `\sqrt[n]{x}` | `\sqrt[n]{x}` | YES |
| Integrals/sums | `\int_{a}^{b}`, `\sum_{a}^{b}` | same | YES |
| Limits | `base_{lim}` / `base^{up}` | supported | YES |
| Delimiters | `\left(` … `\right)` | `\left(` … `\right)` | YES |
| Matrices | `\begin{matrix}` | `\begin{matrix}` | YES |
| Cases | `\begin{cases}` | `\begin{cases}` | YES |
| Overline/underline | `\overline{e}`, `\underline{e}` | same | YES |
| Accents | `\hat{x}`, `\tilde{x}`, etc. | `\hat{x}` | MOSTLY — some Unicode accents may differ |
| Text runs | raw `m:t` text | inline text | YES |
| **TikZ pictures** | Supported if LaTeX contains `\begin{tikzpicture}` | tikzjax (external) | YES if tikzjax is bundled |
| **Unsupported OMML** | Falls through to `''` | empty render | fallback to picBase64 image |

**No cleaning/transform needed** — pptxtojson's LaTeX output is directly KaTeX-compatible for the vast majority of cases. The `latexFormart()` function already handles the only escaping issues (HTML entities).

---

### Limitations & Risks

- **picBase64 may be low-resolution**: PPTX renders math to a bitmap (PNG/EMF). For complex equations, the image fallback may look better than KaTeX re-render if KaTeX and the PPTX rendering engine disagree on spacing.
- **TikZ is async**: `tikzjax` loads from CDN or is bundled as vendor asset. If not bundled, an iframe-based load is needed.
- **Some OMML not supported by pptxtojson**: If `parseOMath` returns `''` for an unsupported construct, the element falls back to image (if `picBase64` exists) or placeholder.
- **No round-trip**: NavSlides stores LaTeX string — editing would re-emit the KaTeX rendering. Changes in KaTeX display will not update the PPTX equation editor.

### Effort Estimation: **SMALL**
- `mapper.js`: Replace ~7 lines of math handling with ~25 lines.
- `element-renderers.js`: Optional ~5-line change for fallback image.
- No new dependencies.

---

## Summary

| Gap | Current behavior | Fix | Effort |
|---|---|---|---|
| Video import | `videoMode: 'none'`, falls to placeholder | Enable `blob` mode, add `mapVideo` + `persistMediaFromZip` | MEDIUM |
| Audio import | `audioMode: 'none'`, falls to placeholder | Same pattern as video | MEDIUM (part of same change) |
| Math LaTeX | `picBase64` converted to image, LaTeX string discarded | Replace with `LatexElement` using `element.latex`, preserve `picBase64` as fallback | SMALL |

Both gaps are fixable within the existing architecture. Video/audio use the same ZIP-extraction pattern already established for images in `media.js`. Math uses the existing `latex` element type — only the mapping logic needs updating.

---

## Unresolved Questions

1. **Video/audio autoplay**: PPTX stores autoplay/loop in `<p:video>` element attributes. pptxtojson does not expose these — all imported video/audio elements default to `autoplay: false`. Is preserving autoplay behavior a requirement?
2. **External media links**: If a PPTX links to an external video URL (YouTube embed, etc.), pptxtojson returns `{ ref: url, blob: '' }`. Should NavSlides use the URL directly as `src`, or treat it as missing?
3. **Math rendering fallback UX**: When KaTeX rendering fails (bad LaTeX), should the fallback PNG image be shown automatically, or only on explicit user action?
4. **Unsupported video formats (avi, wmv, m4a, flac)**: pptxtojson skips extraction. Should NavSlides add a second-pass that extracts all media regardless of extension, then detects MIME type by magic bytes?
