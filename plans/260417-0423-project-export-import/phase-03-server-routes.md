# Phase 03: Server Routes — Project Import/Export

**Phase:** 03 | **Status:** ⏳ pending

---

## Context

- Explorer report: `plans/reports/Explore-260417-0423-export-import-flow.md`
- Phase 01: `phase-01-export-client.md`
- Phase 02: `phase-02-import-client.md`

---

## Overview

**Priority:** 🟡 Trung bình (Phase 01 + 02 có thể làm trước hoàn toàn client-side)
**Current status:** Server đã có POST /api/presentations với slides array

---

## Key Insights

- `server/routes/presentations.js` đã hỗ trợ POST với `providedSlides[]` (lines 35-125) → có thể dùng cho import
- `server/routes/upload.js` dùng multer → có thể mở rộng để upload ZIP
- File-based storage: `server/data/presentations.json` + `server/data/history/`
- **Design decision**: Import/Export hoàn toàn client-side là đủ. Server route chỉ cần nếu muốn server-side ZIP generation (cho máy yếu) hoặc bulk import qua API

---

## Architecture Decision

### Option A: Client-side only (Recommended — simpler)

- Export: JSZip in-browser → download
- Import: JSZip in-browser → parse → POST to existing `/api/presentations` → upload media via `/api/upload`

**Pros:** Không cần viết server code mới, test dễ
**Cons:** Import lớn tốn memory browser

### Option B: Hybrid (Server-assisted)

- Server có thể serve pre-generated ZIP via GET `/api/presentations/:id/export-project`
- Client-side vẫn cần cho import

**→ Khuyến nghị Option A cho Phase 1**, Option B như enhancement sau

---

## Minimal Server Changes (Option A — None needed)

`POST /api/presentations` (existing) đã hỗ trợ:

```js
// server/routes/presentations.js:35-125
// Path A: POST with providedSlides[]
if (req.body.providedSlides) {
  const presentation = {
    id: generateId(),
    title: req.body.title || 'Imported Presentation',
    slides: req.body.providedSlides,
    theme: req.body.theme || 'black',
    transition: req.body.transition || 'slide',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  // ...
}
```

→ Import client-side có thể gọi `POST /api/presentations` với `providedSlides` = slides array từ parsed file.

---

## Optional: Server ZIP Export Endpoint (Option B Enhancement)

**Chỉ làm nếu cần**

```js
// server/routes/export.js (new file)
const archiver = require('archiver')
const fs = require('fs')
const path = require('path')

// GET /api/presentations/:id/export-project
router.get('/:id/export-project', async (req, res) => {
  const presentations = storage.loadJson('presentations.json')
  const presentation = presentations.find(p => p.id === req.params.id)
  if (!presentation) return res.status(404).json({ error: 'Not found' })

  const html = generateRevealHTML(presentation)
  const zip = archiver('zip', { zlib: { level: 6 } })

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition',
    `attachment; filename="${slugify(presentation.title)}.navslides"`)

  zip.pipe(res)
  zip.append(JSON.stringify({ version: '1.0', title: presentation.title,
    exportedAt: new Date().toISOString(), hasLocalMedia: false }, null, 2),
    { name: 'manifest.json' })
  zip.append(JSON.stringify(presentation, null, 2), { name: 'presentation.json' })
  zip.append(html, { name: 'presentation.html' })
  zip.finalize()
})
```

**Note:** Cần thêm `archiver` vào server dependencies.

---

## API Endpoints Used

| Method | Endpoint | Purpose | Status |
|---|---|---|---|
| `POST` | `/api/presentations` | Create from imported JSON | ✅ existing |
| `POST` | `/api/upload` | Upload extracted media | ✅ existing |
| `GET` | `/api/presentations/:id` | Load presentation | ✅ existing |

---

## Security Considerations

- File size limit: Enforce 200MB max trong multer config (hiện tại: 50MB)
- Path traversal: JSZip in-browser tự handle (chặn `../` paths)
- Server-side: kiểm tra `manifest.version` === '1.0' trước khi process

---

## Implementation Steps

- [ ] **3.1** Verify `POST /api/presentations` xử lý đúng slides array từ imported JSON
- [ ] **3.2** Optional: Tăng multer file size limit lên 200MB
- [ ] **3.3** Optional: Thêm `/api/presentations/:id/export-project` (server ZIP export)
- [ ] **3.4** Test: Import presentation đã export → verify round-trip

---

## Success Criteria

1. `POST /api/presentations` với slides array → tạo presentation đầy đủ
2. Media upload via `/api/upload` → rewrite URLs đúng
3. Server-side ZIP export (nếu làm) → download .navslides file

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Multer file size too small | Low | Medium | Increase to 200MB |
| Path traversal in ZIP | Low | High | JSZip tự handle; server validate |
| Memory pressure on large ZIP | Low | Medium | Stream processing with archiver |

---

## Next Steps

Phase 04 (Tests) — viết unit test cho export/import logic.