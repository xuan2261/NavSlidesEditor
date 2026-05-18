---
phase: 1
title: "Video & Audio Import"
status: pending
priority: P1
effort: ~1 day
dependencies: []
---

# Phase 1: Video & Audio Import

## Overview

Bật video/audio extraction trong pptxtojson + viết handlers trong mapper để tạo `video`/`audio` elements. Hiện tại cả hai bị `videoMode: 'none'`/`audioMode: 'none'` và không có handler → luôn fallback thành placeholder.

## Red Team Fixes Applied
- **[FIX #1]** `persistVideoAudioBlob` phải `await` `entry.async('nodebuffer')` — không phải Promise object
- **[FIX #2]** `mediaIndex.files` là `Map` — phải dùng `.get(normalized)`, không bracket notation
- **[FIX #6]** DRY — gọi `persistZipMediaRef` có sẵn, không tạo function mới
- **[FIX #9]** Export `mapVideo`/`mapAudio` để unit test gọi được
- **[FIX #11]** Handle URL refs cho external media links (YouTube, web-hosted)
- **[FIX #16]** Dùng `uuidv4()` cho filename thay vì `Date.now()` — tránh collision

## Context Links
- Research: `plans/reports/researcher-260501-video-audio-math.md` (Gap 1)
- Mapper: `server/services/pptx-import/mapper.js`
- Parse worker: `server/services/pptx-import/parse-worker.js`
- Media handler: `server/services/pptx-import/media.js` (exports `persistZipMediaRef` at line 82)
- Types: `shared/src/types/presentation.js` (video/audio element schema)

## Requirements
- Functional: Video/audio từ PPTX được extract và lưu vào `server/uploads/`, tạo NavSlides element đúng type
- Non-functional: Xử lý async trong worker, format whitelist, graceful fallback, external URL support

## Related Code Files
- Modify: `server/services/pptx-import/parse-worker.js` — đổi options
- Modify: `server/services/pptx-import/media.js` — export `persistZipMediaRef` nếu chưa, hoặc refactor để reuse
- Modify: `server/services/pptx-import/mapper.js` — thêm `mapVideo()`, `mapAudio()`, update `mapElement()`, export functions
- Modify: `server/services/pptx-import/mapper.test.js` — unit tests

## Implementation Steps

### 1. Enable video/audio in parse-worker

File: `server/services/pptx-import/parse-worker.js` (hiện line ~44)

```js
// Trước:
const options = { imageMode: 'base64', videoMode: 'none', audioMode: 'none' }
// Sau:
const options = { imageMode: 'base64', videoMode: 'blob', audioMode: 'blob' }
```

### 2. Reuse or refactor persistZipMediaRef

**Option A (preferred):** Gọi `persistZipMediaRef` có sẵn trực tiếp. `persistZipMediaRef(mediaIndex, ref, uploadsDir)` tại media.js:82-88 đã handle ZIP extraction đúng cách.

**Option B:** Nếu cần MIME type validation cho video/audio, refactor `persistZipMediaRef` để accept whitelist:

```js
// media.js — export thêm function:
async function persistMediaBlob(mediaIndex, ref, uploadsDir, allowedExts) {
  const normalized = String(ref || '').replace(/\\/g, '/').replace(/^\/+/, '')
  // [FIX #2] Dùng .get() trên Map, không bracket notation
  const entry = mediaIndex.files.get(normalized)
  if (!entry) return null

  const ext = normalized.split('.').pop().toLowerCase()
  if (allowedExts && !allowedExts.includes(ext)) return null

  // [FIX #1] PHẢI await — entry.async() trả Promise
  const buffer = await entry.async('nodebuffer')
  // Gọi persistImageBuffer hoặc write trực tiếp với uuid
  const filename = `${uuidv4()}.${ext}` // [FIX #16] uuidv4 thay vì Date.now
  await fs.ensureDir(uploadsDir)
  await fs.writeFile(path.join(uploadsDir, filename), buffer)
  return `/uploads/${filename}`
}
```

### 3. Add mapVideo() and mapAudio() to mapper.js

File: `server/services/pptx-import/mapper.js`

```js
// Import persistZipMediaRef (đã có sẵn từ media.js line 3-4)
// Không tạo function mới — gọi persistZipMediaRef trực tiếp

// Thêm vào exports ở cuối file (line ~824-827):
module.exports = {
  mapPptxOutput,
  sanitizeHtml,
  mapVideo,    // [FIX #9] Export để test gọi được
  mapAudio,    // [FIX #9]
  extractShadow,
  mapMath,
}
```

**mapVideo implementation:**

```js
async function mapVideo(element, context) {
  // [FIX #11] Handle external URL refs
  const ref = element.ref || ''
  if (/^https?:\/\//i.test(ref)) {
    // External URL — use directly as src
    context.stats.videoCount = (context.stats.videoCount || 0) + 1
    return [{
      ...baseElement(element, context.scale, context.zIndex),
      type: 'video',
      src: ref,
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
    }]
  }

  // ZIP extraction via persistZipMediaRef
  const src = await persistZipMediaRef(context.mediaIndex, ref, context.uploadsDir)
  if (!src) {
    context.stats.placeholderCount += 1
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'video-missing', 'Video media unavailable')]
  }
  context.stats.videoCount = (context.stats.videoCount || 0) + 1
  return [{
    ...baseElement(element, context.scale, context.zIndex),
    type: 'video',
    src,
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
  }]
}
```

**mapAudio implementation:**

```js
async function mapAudio(element, context) {
  const ref = element.ref || ''
  if (/^https?:\/\//i.test(ref)) {
    context.stats.audioCount = (context.stats.audioCount || 0) + 1
    return [{
      ...baseElement(element, context.scale, context.zIndex),
      type: 'audio',
      src: ref,
      autoplay: false,
      loop: false,
      muted: false,
    }]
  }

  const src = await persistZipMediaRef(context.mediaIndex, ref, context.uploadsDir)
  if (!src) {
    context.stats.placeholderCount += 1
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'audio-missing', 'Audio media unavailable')]
  }
  context.stats.audioCount = (context.stats.audioCount || 0) + 1
  return [{
    ...baseElement(element, context.scale, context.zIndex),
    type: 'audio',
    src,
    autoplay: false,
    loop: false,
    muted: false,
  }]
}
```

### 4. Update mapElement dispatch

File: `server/services/pptx-import/mapper.js`, trong `mapElement()`:

```js
async function mapElement(element, context) {
  if (element.type === 'group') return flattenGroupElement(element, context)
  if (element.type === 'image') return mapImage(element, context)
  if (element.type === 'video') return mapVideo(element, context)    // THÊM
  if (element.type === 'audio') return mapAudio(element, context)   // THÊM
  if (element.type === 'table') return mapTable(element, context)
  // ...
}
```

### 5. Update stats initialization (SINGLE point of update)

**CRITICAL [FIX #5]:** Thêm tất cả new stats fields vào stats initialization trong `mapPptxOutput()` tại một chỗ. Không spread across phases.

File: `server/services/pptx-import/mapper.js`, trong `mapPptxOutput()`:

```js
// mapper.js:700 — thay đổi:
const stats = {
  textCount: 0,
  imageCount: 0,
  shapeCount: 0,
  tableCount: 0,
  chartCount: 0,
  placeholderCount: 0,
  videoCount: 0,    // THÊM
  audioCount: 0,    // THÊM
  mathCount: 0,    // THÊM (dùng ở Phase 2)
}
```

## Success Criteria
- [ ] `videoMode: 'blob'`, `audioMode: 'blob'` trong parse-worker
- [ ] External URL refs → used as `src` directly
- [ ] ZIP refs → extracted via `persistZipMediaRef` (Map.get + await + uuidv4 filename)
- [ ] `mapVideo()` tạo `type: 'video'` element với `src`
- [ ] `mapAudio()` tạo `type: 'audio'` element với `src`
- [ ] Unsupported format / missing ref → placeholder
- [ ] Stats: `videoCount`, `audioCount` initialized + incremented
- [ ] `mapVideo`/`mapAudio` exported from mapper.js

## Risk Assessment
- **Risk:** pptxtojson `videoMode: 'blob'` crashes in Node.js because `URL.createObjectURL` is undefined → **Mitigation:** Monkey-patch `globalThis.URL` with a no-op before requiring pptxtojson; pptxtojson checks `typeof URL !== 'undefined'` before calling it. Verify this path.
- **Risk:** `persistZipMediaRef` returns null because path normalization differs → **Mitigation:** Log `ref` vs available keys in mediaIndex for debugging; add trailing-slash variant to normalization.
- **Risk:** pptxtojson emits different path keys in `mediaIndex` vs `element.ref` → **Mitigation:** Test with real PPTX files containing video/audio.
