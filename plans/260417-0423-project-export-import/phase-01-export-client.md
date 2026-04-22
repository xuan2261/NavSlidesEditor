# Phase 01: Export Project — Client-Side

**Phase:** 01 | **Status:** ⏳ pending

---

## Context

- Explorer report: `plans/reports/Explore-260417-0423-export-import-flow.md`
- Researcher report: `plans/reports/researcher-260417-0422-project-file-export-import.md`

---

## Overview

**Priority:** 🔴 Cao
**Current status:** Không có chức năng export project

---

## Key Insights

- EditorPage.jsx (1997 LOC) chứa export handlers tại dòng ~1844-1877
- `generateHTML.js` re-exports từ `revealjs-shared/src/htmlGenerator.js`
- `offlineExport.js` (334 LOC) inline CDN resources → đã có pattern fetch + Blob
- pptxgenjs đã dùng sẵn trong `exportPptx.js` — pattern download tương tự
- Cần thêm `jszip` vào `client/package.json`

---

## Requirements

### Functional

1. **Menu item**: EditorMenuBar → File dropdown → "Export Project (.navslides)"
2. **Hybrid logic**:
   - Scan slides elements → detect local media URLs (`/uploads/...`)
   - Có local media → tạo ZIP (manifest.json + presentation.json + media/)
   - Không có local media → tải `.navslides.json`
3. **Filename**: `{presentation-title}-backup-{YYYYMMDD}.navslides`
4. **Auto-include offline HTML** trong ZIP (key feature — user muốn offline xem được)

### Non-functional

- JSZip compress level 6 (performance balanced)
- Max ZIP size warning: 200MB
- Progress indicator cho ZIP lớn (>10 slides + nhiều media)

---

## Architecture

### New Files

```
client/src/utils/
├── export-project.js        # 60-80 LOC — hybrid export logic
└── media-detector.js        # 40 LOC — scan elements for local media URLs
```

### Modified Files

```
client/src/components/
├── EditorMenuBar.jsx        # Thêm menu item "Export Project"
client/src/pages/
└── EditorPage.jsx           # Inject onExportProject handler (3-5 lines)
```

### export-project.js API

```js
/**
 * Scan presentation elements for local media URLs (/uploads/*)
 * Returns: { hasLocalMedia: boolean, mediaUrls: string[] }
 */
export function detectLocalMedia(presentation)

/**
 * Export presentation as .navslides.json (no local media)
 * or .navslides ZIP (has local media)
 */
export async function exportProject(presentation, options?)
```

### detectLocalMedia logic

```js
// Media src patterns to detect local uploads
const LOCAL_URL_PATTERNS = [
  /^\/uploads\//, // relative upload path
  /^http.*\/uploads\//, // absolute upload path
]

// Scan all slides' elements for image/video/media src
function detectLocalMedia(presentation) {
  const mediaUrls = new Set()
  for (const slide of presentation.slides || []) {
    for (const el of slide.elements || []) {
      if (el.src && LOCAL_URL_PATTERNS.some((p) => p.test(el.src))) {
        mediaUrls.add(el.src)
      }
      // Also check backgrounds
      if (slide.background?.type === 'image' && slide.background.src) {
        if (LOCAL_URL_PATTERNS.some((p) => p.test(slide.background.src))) {
          mediaUrls.add(slide.background.src)
        }
      }
    }
  }
  return { hasLocalMedia: mediaUrls.size > 0, mediaUrls: [...mediaUrls] }
}
```

### export-project.js hybrid logic

```js
import JSZip from 'jszip'
import { generateOfflineHTML } from './offlineExport'

export async function exportProject(presentation, opts = {}) {
  const { hasLocalMedia, mediaUrls } = detectLocalMedia(presentation)
  const title = presentation.title || 'presentation'
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  if (!hasLocalMedia) {
    // JSON only export
    const data = {
      version: '1.0',
      title,
      exportedAt: new Date().toISOString(),
      hasLocalMedia: false,
      presentation,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${title}-${timestamp}.navslides.json`)
    return
  }

  // ZIP export with media
  const zip = new JSZip()
  const manifest = {
    version: '1.0',
    title,
    exportedAt: new Date().toISOString(),
    hasLocalMedia: true,
    mediaCount: mediaUrls.length,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  // presentation.json (raw JSON for re-import)
  zip.file('presentation.json', JSON.stringify(presentation, null, 2))

  // Fetch and add local media files
  const mediaFolder = zip.folder('media')
  await Promise.all(
    mediaUrls.map(async (url) => {
      try {
        const fullUrl = url.startsWith('/') ? window.location.origin + url : url
        const resp = await fetch(fullUrl)
        if (!resp.ok) return
        const blob = await resp.blob()
        const filename = url.split('/').pop()
        mediaFolder.file(filename, blob)
      } catch {
        /* skip failed media */
      }
    })
  )

  // Generate offline HTML and add
  const html = await generateOfflineHTML(/* from generateHTML */)
  zip.file('presentation.html', html)

  // Download
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  downloadBlob(zipBlob, `${title}-${timestamp}.navslides`)
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Implementation Steps

- [ ] **1.1** Thêm `jszip` vào `client/package.json` (`npm install jszip --save`)
- [ ] **1.2** Tạo `client/src/utils/media-detector.js` — scan elements cho local URLs
- [ ] **1.3** Tạo `client/src/utils/export-project.js` — hybrid export logic
- [ ] **1.4** Update `EditorMenuBar.jsx` — thêm menu item "Export Project"
- [ ] **1.5** Update `EditorPage.jsx` — inject `onExportProject` handler (~5 lines)

---

## Success Criteria

1. Menu "Export Project" xuất hiện trong File dropdown
2. Presentation không có local media → tải `.navslides.json` đúng format
3. Presentation có local media → tải `.navslides` (ZIP) với manifest + presentation.json + media/
4. ZIP chứa `presentation.html` (offline HTML)
5. Import lại `.navslides.json` tạo được presentation y hệt (round-trip test)

---

## Risk Assessment

| Risk                            | Likelihood | Impact | Mitigation                |
| ------------------------------- | ---------- | ------ | ------------------------- |
| Large media files → slow export | Medium     | Low    | Add progress indicator    |
| Fetch CORS on media URLs        | Low        | Medium | Use same-origin URLs only |
| JSZip bundle size increase      | Low        | Low    | Tree-shakeable import     |

---

## Next Steps

Phase 02 (Import client UI) phụ thuộc Phase 01 (cần biết file format để import đúng).
Phase 03 (server routes) có thể làm song song với Phase 01.
