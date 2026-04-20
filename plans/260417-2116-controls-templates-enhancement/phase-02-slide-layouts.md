# Phase 2: Slide Layout Templates Expansion

## Context
- [EditorPage.jsx:109-371](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/EditorPage.jsx#L109-L371) — SLIDE_TEMPLATES (8 layouts)
- [EditorPage.jsx:3421-3600](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/EditorPage.jsx#L3421-L3600) — Template modal UI
- [EditorPage.jsx:1688-1720](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/EditorPage.jsx#L1688-L1720) — addSlide function

## Overview
- Priority: P0
- Status: ✅ Completed
- Mở rộng SLIDE_TEMPLATES từ 8 → 20 layouts, extract ra file riêng để giảm EditorPage.jsx

## Requirements

### Functional
1. Extract `SLIDE_TEMPLATES` ra `client/src/data/slide-templates.js`
2. Thêm 12 slide layouts mới
3. Cải tiến template modal UI: grid 4 cột, scroll, category grouping
4. Mỗi layout có mini preview icon trong modal

### 12 Layouts mới

| # | Key | Label | Mô tả |
|---|-----|-------|--------|
| 1 | `quote` | Quote | Trích dẫn lớn + tác giả, icon quote mark |
| 2 | `agenda` | Agenda / TOC | Mục lục numbered sections, bên trái numbering |
| 3 | `timeline` | Timeline | 4 milestones horizontal với dots + lines |
| 4 | `four-grid` | 4-Grid | 2×2 grid cards với accent borders |
| 5 | `steps` | Steps / Process | 3 numbered steps horizontal, arrow connectors |
| 6 | `team` | Team Profile | Avatar placeholder + name + role |
| 7 | `thank-you` | Thank You | Kết bài, centered text + accent line |
| 8 | `definition` | Definition | Term highlighted + definition paragraph |
| 9 | `pro-con` | Pro / Con | Two columns với ✅/❌ headers, green/red accents |
| 10 | `key-takeaways` | Key Takeaways | 4 bullet points với icon bullets |
| 11 | `qa` | Q&A | Câu hỏi & thảo luận ending slide |
| 12 | `image-gallery` | Image Gallery | 3 image placeholders in a row |

## Architecture

### File Extraction
```
client/src/data/slide-templates.js  ← NEW: export SLIDE_TEMPLATES object
client/src/pages/EditorPage.jsx     ← import SLIDE_TEMPLATES from '../data/slide-templates'
```

### Template Data Structure (unchanged)
```js
{
  label: 'Quote',
  icon: '❝',        // NEW: emoji icon for modal preview
  category: 'basic', // NEW: 'basic' | 'content' | 'layout' | 'ending'
  elements: [
    { type: 'text', x, y, width, height, zIndex, content },
    { type: 'shape', ... },
  ]
}
```

### Modal UI Improvement
- Group templates by category: Basic, Content, Layout, Ending
- 4 columns grid instead of 3
- Mini preview icons rendered from template data
- Scrollable if > 2 rows per category

## Related Code Files

### Create
- `client/src/data/slide-templates.js` — Extracted + expanded SLIDE_TEMPLATES

### Modify
- `client/src/pages/EditorPage.jsx` — Remove SLIDE_TEMPLATES definition, import from new file
- Template modal JSX — Update grid layout (4 cols), add category headers, add new template previews

## Implementation Steps

1. **Create slide-templates.js**
   - Move existing 8 templates from EditorPage.jsx lines 109-371
   - Add `icon` and `category` fields to existing templates
   - Add 12 new template definitions with proper elements arrays
   - `export default SLIDE_TEMPLATES`

2. **Design each template's elements**
   - `quote`: Large text (italic, 36px) + divider shape + author text (right-aligned)
   - `agenda`: Numbered list text (left, 60% width) + accent sidebar shape (left 4px strip)
   - `timeline`: 4 circle shapes (dots) + connecting line shape + 4 label text boxes below
   - `four-grid`: 4 rounded-rect shapes (2×2) + 4 text boxes inside each
   - `steps`: 3 circle shapes (numbered 1,2,3) + 2 arrow-right shapes + 3 text labels
   - `team`: Circle shape (avatar placeholder) + name text (h2) + role text (subtitle)
   - `thank-you`: Large "Thank You" text + accent line shape + subtitle text
   - `definition`: Term text (h2, accent color) + definition text (paragraph)
   - `pro-con`: 2 rounded-rect shapes (green/red borders) + ✅/❌ headers + text boxes
   - `key-takeaways`: Title h2 + 4 text items with icon bullets (star shapes)
   - `qa`: Large "Q&A" text + subtitle + decorative shape
   - `image-gallery`: 3 rect shapes (image placeholders) + title text

3. **Update EditorPage.jsx**
   - Remove lines 109-371 (SLIDE_TEMPLATES constant)
   - Add `import SLIDE_TEMPLATES from '../data/slide-templates'`
   - Update template modal: group by category, 4-column grid

4. **Update modal preview icons**
   - Each template gets a mini preview icon (emoji or SVG-based)
   - Category headers: "📝 Basic", "📄 Content", "📐 Layout", "🎬 Ending"

## Todo List

- [x] Create `client/src/data/slide-templates.js` with existing 8 templates
- [x] Add category + icon fields to existing templates
- [x] Add `quote` template
- [x] Add `agenda` template
- [x] Add `timeline` template
- [x] Add `four-grid` template
- [x] Add `steps` template
- [x] Add `team` template
- [x] Add `thank-you` template
- [x] Add `definition` template
- [x] Add `pro-con` template
- [x] Add `key-takeaways` template
- [x] Add `qa` template
- [x] Add `image-gallery` template
- [x] Update EditorPage.jsx — import + remove old SLIDE_TEMPLATES
- [x] Update template modal UI — 4-column grid, categories, scroll
- [x] Build test: npm run build
- [x] Visual test: all 20 templates add correctly and look good

## Success Criteria
- ✅ EditorPage.jsx reduced by ~260 lines (SLIDE_TEMPLATES extracted)
- ✅ 20 slide layout templates available in "Add Slide" modal
- ✅ Templates grouped by category in modal
- ✅ Each template creates proper elements on the slide
- ✅ Build passes without errors
