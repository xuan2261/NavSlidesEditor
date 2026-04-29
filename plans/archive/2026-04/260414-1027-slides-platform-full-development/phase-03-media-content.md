# Phase 3 — Media & Content Enhancement

## Overview

- **Priority**: P1
- **Status**: ⬜ Pending
- **Effort**: 3-4 tuần
- **Dependencies**: Phase 0 (Foundation Refactor)
- **Mục tiêu**: Rich media management + import capabilities + template marketplace

## Features to Implement

### 3.1 Media Library

**Mô tả**: Persistent library để browse/search tất cả uploaded assets.

**Implementation**:

**Server-side:**

- Endpoint `GET /api/media` → scan uploads dir, return metadata
- Store metadata trong `server/data/media.json`:
  ```json
  [
    {
      "id": "uuid",
      "filename": "uuid.jpg",
      "originalName": "photo.jpg",
      "type": "image",
      "size": 245000,
      "width": 1920,
      "height": 1080,
      "tags": ["landscape"],
      "uploadedAt": "2026-04-14T..."
    }
  ]
  ```
- On upload: extract metadata (dimensions for images via `sharp` hoặc `image-size`)
- Endpoint `DELETE /api/media/:id` — delete file + metadata
- Endpoint `PUT /api/media/:id` — update tags/name

**Client-side:**

- MediaLibraryModal component:
  - Grid view of all uploaded media
  - Search by filename/tags
  - Filter by type (image/video/audio)
  - Click to insert into current slide
  - Drag from library onto canvas
  - Upload new files from modal
  - Delete unused media

**Files**: NEW `server/routes/media.js`, NEW `MediaLibraryModal.jsx`, `Toolbar.jsx`

---

### 3.2 Unsplash Integration

**Mô tả**: Search + insert free stock photos từ Unsplash.

**Implementation**:

- Unsplash API (free tier, 50 requests/hour)
- User cung cấp API key via Settings page (hoặc built-in demo key)
- Search UI trong Media Library modal
- Tab: "My Media" | "Unsplash" | "GIPHY"
- Click to download + insert as image element
- Auto-download to uploads/ for offline use
- Attribution text option

```javascript
// API call
const response = await fetch(`https://api.unsplash.com/search/photos?query=${query}&per_page=20`, {
  headers: { Authorization: `Client-ID ${apiKey}` },
})
```

**Files**: NEW `services/unsplash.js`, MediaLibraryModal tab, Settings (API key)

---

### 3.3 GIPHY Integration

**Mô tả**: Search + insert GIFs.

**Implementation**:

- GIPHY API (free tier, unlimited for development)
- Tab trong Media Library
- Preview GIFs before insert
- Download to uploads/ as .gif or .webp

**Files**: NEW `services/giphy.js`, MediaLibraryModal tab

---

### 3.4 Import PDF → Slides

**Mô tả**: Convert PDF pages thành image slides.

**Implementation**:

- Upload PDF file to server
- Server-side: use `pdf-poppler` hoặc `pdf2pic` to render each page as image
- Alternative (simpler): Use `pdfjs-dist` client-side to render pages to canvas → export as images
- Each page → 1 slide with full-screen image element

```javascript
// Client-side approach with pdfjs-dist
import * as pdfjsLib from 'pdfjs-dist'

async function pdfToSlides(file) {
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise
  const slides = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const canvas = document.createElement('canvas')
    const viewport = page.getViewport({ scale: 2 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
    // Upload blob to server
    const formData = new FormData()
    formData.append('file', blob, `page-${i}.png`)
    const { url } = await api.uploadFile(formData)
    slides.push({
      id: crypto.randomUUID(),
      elements: [
        {
          id: crypto.randomUUID(),
          type: 'image',
          x: 0,
          y: 0,
          width: 960,
          height: 540,
          src: url,
          objectFit: 'contain',
        },
      ],
      background: { type: 'color', color: '#ffffff' },
    })
  }
  return slides
}
```

**Files**: NEW `utils/pdf-import.js`, Import dialog in HomePage, `package.json` (add pdfjs-dist)

---

### 3.5 Import Markdown → Deck

**Mô tả**: Convert full Markdown document thành presentation.

**Implementation**:

- Parse markdown, split by `---` (horizontal rule) hoặc `## Heading` → mỗi section = 1 slide
- Convert markdown → HTML via `marked` (already available)
- Mỗi slide: 1 text element chứa rendered HTML
- Auto-detect: heading slides (chỉ có h1/h2) → title template layout

```javascript
function markdownToSlides(md) {
  // Split by --- or ## headings
  const sections = md.split(/\n---\n|\n(?=## )/)
  return sections.map((section) => {
    const html = marked.parse(section.trim())
    const isTitle = /^<h[12]>/.test(html) && !html.includes('<p>')
    return {
      id: crypto.randomUUID(),
      elements: [
        {
          id: crypto.randomUUID(),
          type: 'text',
          x: isTitle ? 80 : 60,
          y: isTitle ? 180 : 40,
          width: isTitle ? 800 : 840,
          height: isTitle ? 180 : 460,
          zIndex: 1,
          content: html,
        },
      ],
      background: { type: 'color', color: '#1e1e2e' },
    }
  })
}
```

**Files**: NEW `utils/markdown-import.js`, Import dialog

---

### 3.6 Template Marketplace

**Mục tiêu**: Thư viện template đa dạng, phân loại theo chủ đề, đặc biệt cho miền Quân sự / Kỹ thuật / Chiến thuật.

#### Template Categories

| Category        | ID            | Templates                                                                         |
| --------------- | ------------- | --------------------------------------------------------------------------------- |
| **Quân sự**     | `military`    | Briefing chiến thuật, Báo cáo tình hình, Huấn luyện, Đánh giá chiến dịch          |
| **Kỹ thuật**    | `engineering` | Technical Report, Lab Results, System Architecture, Project Status                |
| **Chiến thuật** | `tactical`    | Mission Planning, OPORD (Operations Order), Terrain Analysis, After Action Review |
| **Academic**    | `academic`    | Research Paper, Thesis Defense, Lecture, Seminar                                  |
| **Corporate**   | `corporate`   | Quarterly Review, Product Launch, Team Meeting, Sales Pitch                       |
| **Creative**    | `creative`    | Portfolio, Pitch Deck, Event, Storytelling                                        |
| **Blank**       | `blank`       | Clean templates (dark, light, gradient, minimal)                                  |

#### Template Data Structure

```javascript
// server/data/template-marketplace.json
{
  "categories": [
    {
      "id": "military",
      "name": "Quân sự",
      "nameEn": "Military",
      "icon": "shield",
      "description": "Templates cho briefing, báo cáo và huấn luyện quân sự",
      "templates": [
        {
          "id": "mil-tactical-briefing",
          "title": "Tactical Briefing",
          "titleVi": "Briefing Chiến thuật",
          "description": "Standard military briefing format with situation, mission, execution sections",
          "thumbnail": { "type": "gradient", "gradient": "linear-gradient(135deg, #1a2332, #2d3748)" },
          "theme": "black",
          "transition": "fade",
          "slides": [ /* 5-8 pre-designed slides */ ]
        }
      ]
    }
  ]
}
```

#### Military Templates (Chi tiết)

**1. Tactical Briefing (Briefing Chiến thuật)**

- Slide 1: Title — đơn vị, nhiệm vụ, ngày
- Slide 2: Situation (Tình hình) — bản đồ placeholder, bullet points
- Slide 3: Mission (Nhiệm vụ) — bold mission statement
- Slide 4: Execution (Thực hiện) — timeline, phases
- Slide 5: Service Support (Hậu cần) — logistics table
- Slide 6: Command & Signal (Chỉ huy & Liên lạc)
- Colors: Navy (#1a2332), Gold accents (#d4a373), White text

**2. Situation Report (Báo cáo tình hình)**

- SITREP format: Who, What, When, Where, Why
- Status indicators (green/amber/red)
- Map/diagram placeholder
- Colors: Dark green (#1a2e1a), White text

**3. Training Briefing (Huấn luyện)**

- Objectives, Standards, Conditions
- Safety considerations slide
- Schedule/timeline
- Colors: Dark blue, Orange accents

**4. Campaign Assessment (Đánh giá chiến dịch)**

- Metrics/KPIs with big numbers
- Comparison slides
- Lessons learned
- Colors: Slate (#334155), Blue accents

#### Engineering Templates

**1. Technical Report**

- Abstract, Methodology, Results, Conclusions
- Chart placeholders, data tables
- Clean serif typography
- Colors: White background, dark text, blue accents

**2. System Architecture**

- Components overview
- Data flow diagrams (placeholder shapes)
- Tech stack slide
- Colors: Dark gradient, indigo accents

**3. Project Status**

- Progress bars (using shapes)
- Timeline/milestones
- Risk matrix
- RAG status indicators
- Colors: Corporate blue, gray accents

#### Tactical Templates

**1. OPORD (Operations Order)**

- 5-paragraph order format
- Task Organization
- Coordinating Instructions
- Fire Support Plan
- Colors: OD Green (#3d4a2e), Khaki text

**2. Terrain Analysis (OAKOC)**

- Observation & Fields of Fire
- Avenues of Approach
- Key Terrain
- Obstacles
- Cover & Concealment
- Colors: Earth tones, topographic feel

**3. After Action Review (AAR)**

- What was planned
- What actually happened
- Why it happened
- What to sustain/improve
- Colors: Dark with amber highlights

#### Template Gallery UI

```
┌──────────────────────────────────────────────────────────────────┐
│ Template Gallery                                      [Search]  │
├──────────────────────────────────────────────────────────────────┤
│ [All] [🛡 Quân sự] [⚙ Kỹ thuật] [🎯 Chiến thuật]             │
│ [🎓 Academic] [💼 Corporate] [🎨 Creative] [📄 Blank]          │
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Preview  │ │ Preview  │ │ Preview  │ │ Preview  │            │
│ │          │ │          │ │          │ │          │            │
│ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤            │
│ │ Tactical │ │ SITREP   │ │ Training │ │ Campaign │            │
│ │ Briefing │ │ Report   │ │ Brief    │ │ Review   │            │
│ │ 6 slides │ │ 5 slides │ │ 7 slides │ │ 8 slides │            │
│ │ [Use]    │ │ [Use]    │ │ [Use]    │ │ [Use]    │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│ [Preview] button → opens modal with slide-by-slide preview     │
└──────────────────────────────────────────────────────────────────┘
```

#### Template Storage

- Built-in templates: `server/data/built-in-templates.json` (shipped with app)
- User templates: `server/data/templates.json` (existing)
- API: `GET /api/templates/marketplace` → returns categories + built-in templates
- Merge built-in + user templates trong client

**Files**:

- NEW `server/data/built-in-templates.json` (large file, ~500KB with all templates)
- NEW `server/routes/marketplace.js`
- NEW `client/src/components/dashboard/TemplateGallery.jsx`
- NEW `client/src/components/dashboard/TemplatePreview.jsx`

---

## Todo List

- [ ] Media Library server endpoints (list, delete, update tags)
- [ ] Media Library modal UI (grid, search, filter, drag-to-insert)
- [ ] Media metadata extraction on upload (dimensions, type)
- [ ] Unsplash API integration + search UI
- [ ] GIPHY API integration + search UI
- [ ] PDF import (client-side pdfjs-dist)
- [ ] Markdown import parser + slide generation
- [ ] Import dialog in HomePage
- [ ] Template marketplace data structure
- [ ] Create Military templates (4 templates × 5-8 slides each)
- [ ] Create Engineering templates (3 templates)
- [ ] Create Tactical templates (3 templates)
- [ ] Create Academic templates (4 templates)
- [ ] Create Corporate templates (4 templates)
- [ ] Create Creative templates (3 templates)
- [ ] Template Gallery UI with categories
- [ ] Template preview modal
- [ ] API for marketplace templates
- [ ] Settings page: Unsplash/GIPHY API keys

## Success Criteria

- [ ] Media Library shows all uploaded files with search
- [ ] Can insert media from library by click or drag
- [ ] Unsplash search works and downloads to local storage
- [ ] PDF files convert to image slides
- [ ] Markdown converts to multi-slide presentation
- [ ] Template Gallery has 20+ templates across 7 categories
- [ ] Military/Tactical/Engineering templates have appropriate designs
- [ ] Template preview shows slide-by-slide before using
