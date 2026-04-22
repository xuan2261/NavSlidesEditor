# Phase 02: Import Project — Client-Side

**Phase:** 02 | **Status:** ⏳ pending

---

## Context

- Explorer report: `plans/reports/Explore-260417-0423-export-import-flow.md`
- Phase 01: `phase-01-export-client.md`

---

## Overview

**Priority:** 🔴 Cao
**Current status:** Không có chức năng import project

---

## Requirements

### Functional

1. **HomePage upload zone**: Drag-drop hoặc click để upload `.navslides` / `.navslides.json`
2. **EditorPage**: Menu File → "Open Project..." → file picker → load vào editor
3. **Validation**: Kiểm tra file format (version field, valid JSON, manifest.json nếu ZIP)
4. **Media handling**: Khi import ZIP → upload media files lên server → rewrite URLs
5. **Feedback**: Progress bar cho ZIP import lớn, error message nếu file hỏng

### Non-functional

- Accept both `.navslides` (ZIP) and `.navslides.json` (JSON)
- Max file size: 200MB (warn user)
- Filename sanitization

---

## Architecture

### New Files

```
client/src/utils/
└── import-project.js    # 80-100 LOC — parse ZIP/JSON, extract media, validate
```

### Modified Files

```
client/src/pages/
├── HomePage.jsx         # Thêm import drop zone
└── EditorPage.jsx       # Thêm "Open Project" menu item + load logic
client/src/utils/
└── api.js               # Thêm api.importProject()
```

### import-project.js API

```js
/**
 * Parse uploaded file (.navslides ZIP or .navslides.json)
 * Returns: { type: 'zip'|'json', presentation: object, media?: Map }
 */
export async function parseProjectFile(file)

/**
 * Validate project file structure
 * Returns: { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateProjectFile(parsed)

/**
 * Rewrites local media URLs → uploaded server URLs
 * Called after media files are uploaded to server
 */
export function rewriteMediaUrls(presentation, urlMap)
```

### parseProjectFile logic

```js
import JSZip from 'jszip'

export async function parseProjectFile(file) {
  const isZip = file.name.endsWith('.navslides') && !file.name.endsWith('.json')

  if (!isZip) {
    // JSON file
    const text = await file.text()
    const data = JSON.parse(text)
    return { type: 'json', presentation: data.presentation, manifest: data }
  }

  // ZIP file
  const zip = await JSZip.loadAsync(file)
  const manifestJson = await zip.file('manifest.json')?.async('text')
  const manifest = manifestJson ? JSON.parse(manifestJson) : null

  // presentation.json is required
  const presJson = await zip.file('presentation.json')?.async('text')
  if (!presJson) throw new Error('Invalid .navslides: missing presentation.json')
  const presentation = JSON.parse(presJson)

  // Collect media files
  const mediaFiles = {}
  const mediaFolder = zip.folder('media')
  if (mediaFolder) {
    const files = mediaFolder.files
    for (const [name, zipEntry] of Object.entries(files)) {
      if (!zipEntry.dir) {
        const data = await zipEntry.async('blob')
        mediaFiles[name] = data
      }
    }
  }

  return { type: 'zip', presentation, manifest, mediaFiles }
}
```

### validateProjectFile logic

```js
export function validateProjectFile(parsed) {
  const errors = []
  const warnings = []

  if (!parsed.presentation) {
    errors.push('Missing presentation data')
    return { valid: false, errors, warnings }
  }

  // Version check
  if (parsed.manifest?.version && parsed.manifest.version !== '1.0') {
    warnings.push(`Unknown version: ${parsed.manifest.version}. Expected 1.0`)
  }

  // Structure check
  if (!parsed.presentation.title) {
    warnings.push('Presentation missing title field')
  }
  if (!Array.isArray(parsed.presentation.slides)) {
    errors.push('Invalid structure: slides must be an array')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
```

---

## HomePage UI — Import Zone

```
┌─────────────────────────────────────────────────────────┐
│  Welcome to NavSlides                                   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  📁 Drop .navslides file here or click to browse │   │
│  │                                                 │    │
│  │  Accepts: .navslides (ZIP), .navslides.json    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Recent Presentations                                   │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

**Implementation approach:**

- Use existing `MediaLibraryModal` pattern (modal overlay) or inline drop zone
- Simple: `<input type="file" accept=".navslides,.navslides.json">` styled as drop zone
- On file select → `parseProjectFile()` → `validateProjectFile()` → `api.createPresentation()` → navigate to `/editor/:newId`

### HomePage changes

```jsx
// Trong HomePage — thêm drop zone gần header
const handleProjectDrop = async (e) => {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0]
  if (!file) return

  try {
    const parsed = await parseProjectFile(file)
    const { valid, errors, warnings } = validateProjectFile(parsed)
    if (!valid) {
      alert('Invalid project file: ' + errors.join(', '))
      return
    }

    // Upload media if ZIP
    let finalPresentation = parsed.presentation
    if (parsed.mediaFiles) {
      finalPresentation = await uploadAndRewriteMedia(parsed.presentation, parsed.mediaFiles)
    }

    // Create new presentation
    const newPres = await api.createPresentation(finalPresentation)
    navigate(`/editor/${newPres.id}`)
  } catch (err) {
    alert('Import failed: ' + err.message)
  }
}
```

---

## EditorPage "Open Project" integration

```jsx
// EditorMenuBar — File dropdown
{ type: 'button', label: 'Open Project...', icon: FolderOpen, onClick: openProjectFilePicker }

// EditorPage
const openProjectFilePicker = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.navslides,.navslides.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    // ... same parse/validate/create flow as HomePage
    const parsed = await parseProjectFile(file)
    const { valid } = validateProjectFile(parsed)
    if (!valid) { alert('Invalid file'); return }
    const newPres = await api.createPresentation(parsed.presentation)
    navigate(`/editor/${newPres.id}`)
  }
  input.click()
}
```

---

## API changes (client/src/utils/api.js)

```js
// Add to api object
importProject: async (file) => {
  const parsed = await parseProjectFile(file)
  const { valid, errors } = validateProjectFile(parsed)
  if (!valid) throw new Error(errors.join('; '))

  // Upload media files
  let presentation = parsed.presentation
  if (parsed.mediaFiles) {
    const urlMap = {}
    for (const [name, blob] of Object.entries(parsed.mediaFiles)) {
      const uploaded = await api.uploadFile(new File([blob], name))
      urlMap[`/uploads/${name}`] = uploaded.url
    }
    presentation = rewriteMediaUrls(presentation, urlMap)
  }

  return api.createPresentation(presentation)
}
```

---

## Implementation Steps

- [ ] **2.1** Tạo `client/src/utils/import-project.js` — parse + validate logic
- [ ] **2.2** Update `client/src/utils/api.js` — thêm `importProject()` + `uploadMedia()`
- [ ] **2.3** Update `EditorMenuBar.jsx` — thêm "Open Project..." menu item
- [ ] **2.4** Update `EditorPage.jsx` — inject open handler (~10 lines)
- [ ] **2.5** Update `HomePage.jsx` — thêm import drop zone (near welcome section)
- [ ] **2.6** Test round-trip: export → import → verify data identical

---

## Success Criteria

1. Drop `.navslides.json` vào HomePage → tạo presentation mới → navigate đúng
2. Import `.navslides` (ZIP) → upload media → rewrite URLs → presentation hoạt động
3. Invalid file → show error message rõ ràng
4. "Open Project..." từ Editor → file picker → load presentation vào editor mới
5. Round-trip test: export → close → import → verify slides identical

---

## Risk Assessment

| Risk                                     | Likelihood | Impact | Mitigation                        |
| ---------------------------------------- | ---------- | ------ | --------------------------------- |
| Media upload fails → broken images       | Medium     | Medium | Show error, allow retry           |
| Large ZIP import (100MB+) → memory issue | Medium     | Low    | Stream processing, chunked        |
| Duplicate title on import                | Low        | Low    | Auto-append "- Imported" to title |

---

## Next Steps

Phase 03 (server routes) cần thêm endpoints để hỗ trợ import (POST /api/presentations với slides array đã có sẵn).
