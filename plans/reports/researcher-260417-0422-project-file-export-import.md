# Báo Cáo Nghiên Cứu: Export/Import File Project Cho Presentation Editor

**Tác giả:** Researcher Agent
**Ngày:** 2026-04-17
**Task:** Best practices cho project file export/import trong presentation editors

---

## 1. Google Slides

- **Format chính:** Google Slides dùng cloud storage, không có định dạng `.slides` cục bộ
- **Export:** `.pptx` (default), `.pdf`, PNG/JPG (per slide), TXT
- **Import:** Tự động convert `.pptx`, `.ppt`, `.odp` khi upload lên Google Drive
- **API:** `presentations.create` endpoint hỗ trợ programmatic import/export
- **Lưu ý:** Animations và transitions có thể mất partially khi convert

---

## 2. Canva, Figma, Notion

### Canva

- Export: PNG, JPG, PDF, SVG, GIF (không có backup project đầy đủ)
- Pro users có thể export source code

### Figma

- File `.fig` có thể save local
- Backup tự động qua cloud + version history
- Export: PNG, JPG, SVG, PDF, DXF

### Notion

- Export: Markdown, CSV, HTML
- Team plan: bulk export
- Restore qua trash trong 30 ngày

---

## 3. PowerPoint File Format (.pptx)

PPTX là **ZIP container chứa XML**:

```
mypresentation.pptx (ZIP)
├── [Content_Types].xml       # MIME types
├── _rels/                     # Relationships
├── docProps/                  # Metadata (title, author, dates)
└── ppt/
    ├── presentation.xml       # Master slide layout
    ├── slides/slide*.xml      # Content per slide
    ├── themes/                # Styling
    └── medias/                # Binary media files
```

**Pattern cho NavSlides:**

- Dùng ZIP làm container
- `manifest.json` khai báo cấu trúc
- `slides/` chứa JSON cho từng slide
- `assets/` chứa media files
- Schema versioning để backward compatibility

---

## 4. Best Practices Cho .json Project Files

### Schema Design

- **Bắt buộc có `version` field** để handle migration khi schema thay đổi
- **Idempotent:** cùng content → cùng output (quan trọng cho git/diff)
- **Include checksum/hash** để detect corruption

```json
{
  "version": "2.1.0",
  "id": "uuid-here",
  "created": "ISO-8601",
  "slides": [...],
  "assets": [...]
}
```

### Import/Export

- **Validation:** Dùng JSON Schema hoặc `zod` trước khi process
- **Atomic writes:** Write to temp → rename (tránh corruption khi crash)
- **Partial import:** Hỗ trợ import từng slide riêng lẻ
- **Graceful degradation:** Thông báo lỗi rõ ràng, không crash app

---

## 5. JSZip Patterns Trong React

### Installation

```bash
npm install jszip file-saver
```

### Export Pattern

```javascript
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

async function exportProject(presentation, assets) {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(presentation, null, 2))

  // Add assets
  for (const asset of assets) {
    zip.file(`assets/${asset.name}`, asset.blob)
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  saveAs(blob, `navslides-${Date.now()}.navslides`)
}
```

### Import Pattern

```javascript
async function importProject(file) {
  const zip = await JSZip.loadAsync(file)
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'))

  // Validate version trước khi process
  return { manifest, assets: zip }
}
```

---

## 6. Security Considerations

### Zip Slip Attack Prevention (CRITICAL)

- **Luôn sanitize file paths** trong ZIP trước khi extract
- Kiểm tra `../` hoặc absolute paths
- Dùng library đã được validate (JSZip đã handle tốt)

### File Size Limits

- Set max file size (recommend: 50-100MB cho project files)
- Check `file.size` trước khi load vào memory
- Stream processing cho files > 10MB

### Malicious Content

- Validate MIME type không chỉ qua extension
- Scan content của JSON manifest
- Không execute任何 code từ uploaded files
- Consider: Virus scanning service cho enterprise use cases

---

## Khuyến Nghị Cho NavSlides

1. **Định dạng:** `.navslides` = ZIP container (adopt PPTX pattern)
2. **Structure:**
   ```
   manifest.json     # Presentation metadata + version
   slides/          # Individual slide JSONs
   assets/          # Media files (images, fonts)
   ```
3. **Implementation:** JSZip + file-saver cho client-side export
4. **Security:** Validate paths, size limits, JSON schema check
5. **Compatibility:** Include version field, plan migration path

---

## Unresolved Questions

- NavSlides có cần hỗ trợ import từ Google Slides format không?
- Binary media assets nên store như file references hay embed trong ZIP?
- Có cần incremental sync hay full export là đủ?

---

**Sources:**

- [Google Slides API Documentation](https://developers.google.com/slides)
- [Supported file formats in Google Drive](https://support.google.com/drive)
- [PPTX File Format - ECMA-376 Standard](https://www.ecma-international.org/publications-and-standards/standards/ecma-376/)
- [JSZip Documentation](https://stuk.github.io/jszip/)
- [Zip Slip Vulnerability - Snyk](https://security.snyk.io/research/zip-slip-vulnerability)
