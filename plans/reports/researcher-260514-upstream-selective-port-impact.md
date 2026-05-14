# Research Report - Selective Upstream Port Impact

## Scope
- Work context: `D:\NCKH_2025\NavSlidesEditor`
- Goal: đánh giá impact và test strategy cho việc port chọn lọc fix từ `jbirky/parallax-presentations`
- Không implement

## Nguồn chính đã đối chiếu
- Local docs: [`README.md`](D:\NCKH_2025\NavSlidesEditor\README.md), [`package.json`](D:\NCKH_2025\NavSlidesEditor\package.json), [`client/package.json`](D:\NCKH_2025\NavSlidesEditor\client\package.json), [`server/package.json`](D:\NCKH_2025\NavSlidesEditor\server\package.json), [`vitest.config.mjs`](D:\NCKH_2025\NavSlidesEditor\vitest.config.mjs), [`playwright.config.js`](D:\NCKH_2025\NavSlidesEditor\playwright.config.js)
- Local architecture/docs: [`docs/codebase-summary.md`](D:\NCKH_2025\NavSlidesEditor\docs\codebase-summary.md), [`docs/project-roadmap.md`](D:\NCKH_2025\NavSlidesEditor\docs\project-roadmap.md), [`docs/project-changelog.md`](D:\NCKH_2025\NavSlidesEditor\docs\project-changelog.md)
- Local tests: `shared/tests/*`, `server/routes/*.test.js`, `server/services/*.test.js`, `client/src/**/*.test.*`, `tests/e2e/*`, `tests/load/*`
- Upstream primary source: `git log upstream/main` + `git show` cho commits liên quan

## Kết luận ngắn
Ưu tiên port:
1. `Copy URL` context menu
2. typography extensions / export consistency
3. HTML embed reliability only nếu còn blob URL path thật sự ở local

Không khuyến nghị port ngay:
1. timeline commits
2. cropped image overflow + citations

Lý do: local repo không cùng data model / UI surface cho 2 domain này, nên port sẽ thành feature expansion chứ không phải fix selective.

## Mapping upstream -> local

| Upstream commit | Tình trạng local | Đánh giá |
| --- | --- | --- |
| `6c3ef006` text spacing mismatch 42px -> 16px | Đã có cùng invariant trong [`shared/src/htmlGenerator.js`](D:\NCKH_2025\NavSlidesEditor\shared\src\htmlGenerator.js) | **Already aligned**. Chỉ cần regression check |
| `cde1b2e9` HTML embeds in present mode use data URLs | Local hiện dùng `srcdoc`/`data-pdf-iframe` trong [`shared/src/element-renderers.js`](D:\NCKH_2025\NavSlidesEditor\shared\src\element-renderers.js) + print init trong [`shared/src/htmlGenerator.js`](D:\NCKH_2025\NavSlidesEditor\shared\src\htmlGenerator.js) | **Partially applicable**. Không 1:1, verify trước khi port |
| `93816b88` Copy URL right-click menu | Local context menu có copy/cut/paste/duplicate/reset crop nhưng chưa có Copy URL ở [`client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`](D:\NCKH_2025\NavSlidesEditor\client\src\components\canvas\canvas-right-click-context-menu-for-slide-elements.jsx) | **Directly portable** |
| `0e7196b6` global citation font size/family | Local không thấy citation fields trong [`shared/src/types/presentation.js`](D:\NCKH_2025\NavSlidesEditor\shared\src\types\presentation.js) | **Low fit / likely skip** |
| `315eee97` LaTeX/TikZ font size control | Local đã có FontFamily/FontSize extensions ở [`client/src/extensions/FontFamily.js`](D:\NCKH_2025\NavSlidesEditor\client\src\extensions\FontFamily.js), [`client/src/extensions/FontSize.js`](D:\NCKH_2025\NavSlidesEditor\client\src\extensions\FontSize.js) | **Portable**, nhưng test phải cover editor + export |
| `fe5deaae`, `56067fde`, `2e280692`, `3471ab66`, `a6f42a8b`, `778a7646` timeline fixes | Local chỉ có [`client/src/components/AnimationTimeline.jsx`](D:\NCKH_2025\NavSlidesEditor\client\src\components\AnimationTimeline.jsx) cho fragment sequencing; không có upstream-style timeline element | **Not a direct port target** |
| `b69202d8` cropped image overflow with citation text | Local image model không có citation metadata trong [`shared/src/types/presentation.js`](D:\NCKH_2025\NavSlidesEditor\shared\src\types\presentation.js) | **Not directly applicable** |

## Impact ranking

### 1) Copy URL context menu
- Impact: low-medium
- Risk: low
- Architectural fit: high
- Rationale: chỉ thêm action ở canvas context menu, reuse existing clipboard/runtime URL normalization
- Files likely touched:
  - [`client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`](D:\NCKH_2025\NavSlidesEditor\client\src\components\canvas\canvas-right-click-context-menu-for-slide-elements.jsx)
  - [`client/src/components/SlideCanvas.jsx`](D:\NCKH_2025\NavSlidesEditor\client\src\components\SlideCanvas.jsx)
  - maybe e2e helpers under [`tests/e2e/pages`](D:\NCKH_2025\NavSlidesEditor\tests\e2e\pages)

### 2) Typography extensions / font controls
- Impact: medium-high
- Risk: medium
- Architectural fit: high
- Rationale: local already has font extensions and shared export renderer path, nên đây là fix nhất quán editor/present/export/import
- Files likely touched:
  - [`client/src/components/Toolbar.jsx`](D:\NCKH_2025\NavSlidesEditor\client\src\components\Toolbar.jsx)
  - [`client/src/extensions/FontFamily.js`](D:\NCKH_2025\NavSlidesEditor\client\src\extensions\FontFamily.js)
  - [`client/src/extensions/FontSize.js`](D:\NCKH_2025\NavSlidesEditor\client\src\extensions\FontSize.js)
  - [`shared/src/element-renderers.js`](D:\NCKH_2025\NavSlidesEditor\shared\src\element-renderers.js)
  - [`shared/src/htmlGenerator.js`](D:\NCKH_2025\NavSlidesEditor\shared\src\htmlGenerator.js)
  - import/export adapters in `server/services/pptx-import/*` and `client/src/utils/export-pptx-*`

### 3) HTML embed reliability
- Impact: medium
- Risk: medium-high
- Architectural fit: medium
- Rationale: present mode/export/share use trusted HTML embeds; change phải giữ invariant “trusted programmable content”
- Note: local already moved away from upstream blob pattern ở present path; do đó chỉ port nếu có path còn dùng blob/data-URL timing issue thực tế

### 4) Timeline fix series
- Impact: low in this codebase
- Risk: high nếu cố port
- Architectural fit: low
- Rationale: upstream timeline là content element; local chỉ có animation fragment timeline UI. Port ở đây sẽ lệch feature boundary

### 5) Image overflow + citations
- Impact: low
- Risk: high
- Architectural fit: low
- Rationale: local không có citation fields, nên fix này kéo theo schema/UI/export changes lớn hơn mức selective port

## Test matrix

### A. Copy URL context menu
- Lint: `npm run lint`
- Build: `npm run build`
- Unit: nếu thêm test, cover context menu action normalization ở component test mới hoặc existing canvas helper test
- E2E:
  - `npm run test:e2e -- tests/e2e/element-lifecycle.spec.js`
  - `npm run test:e2e -- tests/e2e/keyboard-shortcuts.spec.js`
  - `npm run test:e2e -- tests/e2e/slide-management.spec.js`
- Manual smoke:
  - right-click image/video element, Copy URL, paste ra clipboard
  - verify relative path -> absolute URL normalization
- Security:
  - no path traversal / javascript: URL copy
  - no clipboard write on locked / missing src element

### B. Typography extensions
- Lint: `npm run lint`
- Build: `npm run build`
- Unit:
  - [`client/src/extensions/FontFamily.js`](D:\NCKH_2025\NavSlidesEditor\client\src\extensions\FontFamily.js)
  - [`client/src/extensions/FontSize.js`](D:\NCKH_2025\NavSlidesEditor\client\src\extensions\FontSize.js)
  - [`client/src/utils/export-pptx-text-runs.test.js`](D:\NCKH_2025\NavSlidesEditor\client\src\utils\export-pptx-text-runs.test.js)
  - [`server/services/pptx-import/property-mapping.test.js`](D:\NCKH_2025\NavSlidesEditor\server\services\pptx-import\property-mapping.test.js)
  - [`server/services/pptx-import/mapper.test.js`](D:\NCKH_2025\NavSlidesEditor\server\services\pptx-import\mapper.test.js)
- E2E:
  - `npm run test:e2e -- tests/e2e/element-properties.spec.js`
  - `npm run test:e2e -- tests/e2e/toolbar-elements.spec.js`
  - `npm run test:e2e -- tests/e2e/export.spec.js`
- Manual smoke:
  - edit font family/size in toolbar
  - reload slide, present mode, export HTML/PDF/PPTX
- Security:
  - ensure no regression on trusted HTML embed or rich text sanitation
  - verify no unsafe style injection into export pipelines

### C. HTML embed reliability
- Lint: `npm run lint`
- Build: `npm run build`
- Unit:
  - [`shared/tests/htmlGenerator.test.js`](D:\NCKH_2025\NavSlidesEditor\shared\tests\htmlGenerator.test.js)
  - [`shared/tests/element-renderers.test.js`](D:\NCKH_2025\NavSlidesEditor\shared\tests\element-renderers.test.js)
  - [`client/src/utils/offlineExport.test.js`](D:\NCKH_2025\NavSlidesEditor\client\src\utils\offlineExport.test.js)
  - [`client/src/utils/export-pptx-raster.test.js`](D:\NCKH_2025\NavSlidesEditor\client\src\utils\export-pptx-raster.test.js)
  - [`server/routes/pptx-export.test.js`](D:\NCKH_2025\NavSlidesEditor\server\routes\pptx-export.test.js)
- E2E:
  - [`tests/e2e/hardening-regression.spec.js`](D:\NCKH_2025\NavSlidesEditor\tests\e2e\hardening-regression.spec.js)
  - [`tests/e2e/export.spec.js`](D:\NCKH_2025\NavSlidesEditor\tests\e2e\export.spec.js)
- Manual smoke:
  - editor iframe render
  - present mode
  - share page
  - export HTML / offline HTML / PDF / PPTX
- Security:
  - trusted embed script still executes only in intentional trusted surfaces
  - no blanket sanitizer regression

### D. Timeline / image-citation branches
- Recommendation: không port ngay, chỉ chạy baseline nếu có dependency bị đụng
- Baseline commands:
  - `npm run lint`
  - `npm run build`
  - `npm run test`
  - `npm run test:e2e`
- Nếu sau này local schema được mở rộng:
  - thêm focused unit + e2e cho image caption/citation rendering
  - thêm manual smoke cho crop/reset/export

## Recommended port order
1. Copy URL context menu
2. Typography extensions / export consistency
3. HTML embed reliability verification, chỉ port nếu tìm thấy blob URL path còn sống
4. Timeline fix series, skip ở current codebase
5. Image overflow + citations, skip ở current codebase

## Limitations
- Chưa chạy `git diff upstream/main...` toàn bộ vì task là research impact, không implementation
- Chưa xác minh từng upstream commit bằng file-level diff ngoài các commit chủ chốt đã mở
- Không cover browser matrix ngoài Chromium vì Playwright config hiện chỉ khai báo Chromium

## Unresolved questions
- Có path blob URL present-mode nào còn sống ngoài `shared/src/element-renderers.js` không
- Team có muốn mở rộng `ImageElement` model để support citation metadata không
- Có ý định đưa upstream timeline element vào NavSlidesEditor hay không
