---
title: "Export/Import Project — Hybrid JSON + ZIP"
status: complete
created: "2026-04-17"
mode: hard
blockedBy: []
blocks: []
source: skill
---

## Mục tiêu

Thêm 2 chức năng:
1. **Export Project**: Serialize presentation JSON → download `.navslides` (ZIP + local media) hoặc `.navslides.json` (JSON thuần)
2. **Import Project**: Upload `.navslides` hoặc `.navslides.json` → tạo presentation mới trên server

## Phương pháp hybrid

- Presentation có local media (uploaded files)? → ZIP export với JSZip
- Không có local media? → JSON export thuần

## Cấu trúc

```
plan.md                    ← overview (this file)
phase-01-export-client.md  ← client-side export (Menu + JSZip logic)
phase-02-import-client.md  ← client-side import (HomePage + EditorPage UI)
phase-03-server-routes.md   ← server API endpoints cho import/export
phase-04-tests.md           ← unit test cho export/import logic
```

## Progress

| Phase | Trạng thái |
|---|---|
| Phase 01: Export (client) | ✅ complete |
| Phase 02: Import (client) | ✅ complete |
| Phase 03: Server routes | ✅ complete |
| Phase 04: Tests | ✅ complete |

## Dependencies

- Thêm `jszip` vào `client/package.json`
- Không cần backend package mới (dùng existing multer)
- EditorPage.jsx (1997 LOC) → extract export logic ra module mới