# Phase 01: Template Data Infrastructure

## Context Links
- [marketplace.js](file:///d:/NCKH_2025/revealjs_gui/server/routes/marketplace.js) — Backend categories + template API
- [built-in-templates.json](file:///d:/NCKH_2025/revealjs_gui/server/data/built-in-templates.json) — Template data store
- [TemplateGallery.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/components/dashboard/TemplateGallery.jsx) — Gallery UI component
- [HomePage.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/HomePage.jsx) — PRESET_THEMES + TEMPLATE_CATEGORIES

## Overview
- **Priority:** P0
- **Status:** ⬜ Pending
- **Effort:** 1-2 ngày
- Thiết lập nền tảng dữ liệu cho 11 ngành kỹ thuật: mở rộng categories, chuẩn hoá schema template, cập nhật icon mapping, thêm tag/subject filtering.

## Key Insights
- Hiện tại `CATEGORIES` trong `marketplace.js` chỉ có 6 items chung (military, engineering, tactical, academic, corporate, creative)
- `built-in-templates.json` chỉ có 1 template duy nhất — cần mở rộng lớn
- `PRESET_THEMES` hardcoded trong `HomePage.jsx` — 6 presets chung
- `TEMPLATE_CATEGORIES` trong HomePage chỉ: `['All', 'Creative', 'Academic', 'Corporate']`
- Template schema hiện tại: `{id, category, title, description, thumbnail, theme, transition, slides}`
- Marketplace API hỗ trợ filter by `?category=X` — cần giữ tương thích

## Requirements

### Functional
1. Thêm 11 engineering categories mới vào marketplace
2. Mỗi category có icon riêng, tên tiếng Việt
3. Template schema bổ sung: `subject`, `tags`, `slideCount`, `difficulty`
4. Filter theo subject area + category trên frontend
5. Giữ backward-compatible với marketplace API hiện tại

### Non-functional
- JSON file lớn → cần invalidate cache khi reload
- Load time < 200ms cho template list

## Architecture

### Expanded Category System
```javascript
const CATEGORIES = [
  // Existing
  { id: 'military', name: 'Quân sự', icon: 'shield' },
  { id: 'academic', name: 'Học thuật', icon: 'book' },
  { id: 'corporate', name: 'Doanh nghiệp', icon: 'briefcase' },
  { id: 'creative', name: 'Sáng tạo', icon: 'palette' },
  // NEW — Engineering subjects
  { id: 'digital-electronics', name: 'Kỹ thuật số', icon: 'cpu' },
  { id: 'microprocessor', name: 'Vi xử lý', icon: 'microchip' },
  { id: 'circuit-theory', name: 'Lý thuyết mạch', icon: 'circuit-board' },
  { id: 'electronics', name: 'Kỹ thuật điện tử', icon: 'radio' },
  { id: 'automation', name: 'Tự động hoá', icon: 'bot' },
  { id: 'electrical', name: 'Điện', icon: 'zap' },
  { id: 'measurement', name: 'Đo lường điện', icon: 'gauge' },
  { id: 'power-electronics', name: 'Điện tử công suất', icon: 'plug-zap' },
  { id: 'mechanical', name: 'Cơ khí', icon: 'wrench' },
  { id: 'technical-drawing', name: 'Hình hoạ - VKT', icon: 'drafting-compass' },
  { id: 'fluid-mechanics', name: 'Thuỷ khí', icon: 'droplets' },
]
```

### Template Schema (Enhanced)
```json
{
  "id": "digi-lecture-overview",
  "category": "digital-electronics",
  "title": "Bài giảng tổng quan - Kỹ thuật số",
  "description": "Template bài giảng tổng quan về cổng logic, đại số Boolean, K-map",
  "tags": ["logic-gate", "boolean", "k-map", "lecture"],
  "difficulty": "intermediate",
  "thumbnail": {
    "type": "gradient",
    "gradient": "linear-gradient(135deg, #0a1628, #00d4ff20)"
  },
  "colorScheme": {
    "primary": "#00d4ff",
    "background": "#0a1628",
    "text": "#e0f2ff",
    "accent": "#00ff87"
  },
  "theme": "black",
  "transition": "slide",
  "slides": [...]
}
```

### Color Scheme Map
```javascript
const SUBJECT_COLORS = {
  'digital-electronics': { primary: '#00d4ff', bg: '#0a1628', text: '#e0f2ff' },
  'microprocessor':      { primary: '#ff6b35', bg: '#1a0e2e', text: '#ffe0d0' },
  'circuit-theory':      { primary: '#00ff87', bg: '#0d1b0e', text: '#d0ffe0' },
  'electronics':         { primary: '#ffd700', bg: '#1a1200', text: '#fff5d0' },
  'automation':          { primary: '#ff4757', bg: '#1a0a0e', text: '#ffd5d0' },
  'electrical':          { primary: '#4ecdc4', bg: '#0a1a18', text: '#d0fff5' },
  'measurement':         { primary: '#a8e6cf', bg: '#0e1a14', text: '#d5ffe8' },
  'power-electronics':   { primary: '#ff8a5c', bg: '#1a100a', text: '#ffe0d5' },
  'mechanical':          { primary: '#95adb6', bg: '#0f1419', text: '#dce5e8' },
  'technical-drawing':   { primary: '#ddd8c4', bg: '#141210', text: '#f0ede0' },
  'fluid-mechanics':     { primary: '#48bfe3', bg: '#0a1628', text: '#d0eeff' },
}
```

## Related Code Files

### Files to modify
- `server/routes/marketplace.js` — Expand CATEGORIES, add cache invalidation
- `server/data/built-in-templates.json` — Add template entries (will grow large)
- `client/src/components/dashboard/TemplateGallery.jsx` — Icon mapping, search
- `client/src/pages/HomePage.jsx` — TEMPLATE_CATEGORIES, marketplace category display

### Files to create
- `server/data/template-schemas/` — Optional: split large JSON into per-category files (nếu JSON > 500KB)

## Implementation Steps

### Step 1: Expand Categories in marketplace.js (15 min)
```javascript
// server/routes/marketplace.js
const CATEGORIES = [
  { id: 'military', name: 'Quân sự', icon: 'shield' },
  { id: 'engineering', name: 'Kỹ thuật', icon: 'cog' },
  { id: 'tactical', name: 'Chiến thuật', icon: 'target' },
  { id: 'academic', name: 'Học thuật', icon: 'book' },
  { id: 'corporate', name: 'Doanh nghiệp', icon: 'briefcase' },
  { id: 'creative', name: 'Sáng tạo', icon: 'palette' },
  // Engineering subjects
  { id: 'digital-electronics', name: 'Kỹ thuật số', icon: 'cpu' },
  { id: 'microprocessor', name: 'Vi xử lý', icon: 'chip' },
  { id: 'circuit-theory', name: 'Lý thuyết mạch', icon: 'git-branch' },
  { id: 'electronics', name: 'Kỹ thuật điện tử', icon: 'radio' },
  { id: 'automation', name: 'Tự động hoá', icon: 'bot' },
  { id: 'electrical', name: 'Điện', icon: 'zap' },
  { id: 'measurement', name: 'Đo lường điện', icon: 'gauge' },
  { id: 'power-electronics', name: 'Điện tử công suất', icon: 'plug-zap' },
  { id: 'mechanical', name: 'Cơ khí', icon: 'wrench' },
  { id: 'technical-drawing', name: 'Hình hoạ - VKT', icon: 'pen-tool' },
  { id: 'fluid-mechanics', name: 'Thuỷ khí', icon: 'droplets' },
];
```

### Step 2: Cache Invalidation (10 min)
```javascript
// marketplace.js — Hiện tại cache vĩnh viễn, cần cho phép reload
let cachedTemplates = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 60s

function loadBuiltInTemplates() {
  const now = Date.now();
  if (cachedTemplates && (now - cacheTimestamp) < CACHE_TTL) return cachedTemplates;
  try {
    cachedTemplates = JSON.parse(fs.readFileSync(BUILT_IN_PATH, 'utf-8'));
    cacheTimestamp = now;
  } catch {
    cachedTemplates = [];
  }
  return cachedTemplates;
}
```

### Step 3: Add search/tag filtering to API (15 min)
```javascript
// GET /api/marketplace/templates?category=X&search=Y&tags=a,b
router.get('/templates', (req, res) => {
  const templates = loadBuiltInTemplates();
  const { category, search, tags } = req.query;
  let result = templates;

  if (category) result = result.filter(t => t.category === category);
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.tags || []).some(tag => tag.includes(q))
    );
  }
  if (tags) {
    const tagList = tags.split(',');
    result = result.filter(t =>
      tagList.every(tag => (t.tags || []).includes(tag))
    );
  }

  res.json({ categories: CATEGORIES, templates: result });
});
```

### Step 4: Update Icon Mapping in TemplateGallery.jsx (15 min)
```javascript
import {
  Shield, Cog, Target, Book, Briefcase, Palette,
  Cpu, Radio, Bot, Zap, Gauge, Wrench, PenTool, Droplets, GitBranch, PlugZap, Chip
} from 'lucide-react';

const ICON_MAP = {
  shield: Shield, cog: Cog, target: Target, book: Book,
  briefcase: Briefcase, palette: Palette,
  cpu: Cpu, chip: Chip, 'git-branch': GitBranch,
  radio: Radio, bot: Bot, zap: Zap, gauge: Gauge,
  'plug-zap': PlugZap, wrench: Wrench, 'pen-tool': PenTool,
  droplets: Droplets,
};
```

### Step 5: Update TEMPLATE_CATEGORIES in HomePage.jsx (10 min)
```javascript
const TEMPLATE_CATEGORIES = [
  'All',
  'Kỹ thuật số', 'Vi xử lý', 'Lý thuyết mạch',
  'Điện tử', 'Tự động hoá', 'Điện',
  'Đo lường', 'ĐTCS', 'Cơ khí', 'VKT', 'Thuỷ khí',
  'Academic', 'Creative', 'Corporate',
]
```

### Step 6: Add search bar to Marketplace view (20 min)
Add search input above category buttons in HomePage marketplace section.

### Step 7: Verify & Test (15 min)
- `npm run dev` → navigate to Marketplace, verify all 17 categories display
- Filter by category → verify empty state message
- Search → verify filtering works
- API: `curl http://localhost:3002/api/marketplace/templates | jq '.categories | length'` → 17

## Todo List

- [ ] Expand CATEGORIES array in marketplace.js
- [ ] Add cache TTL logic
- [ ] Add search/tag filtering to GET /templates endpoint
- [ ] Update ICON_MAP in TemplateGallery.jsx
- [ ] Update TEMPLATE_CATEGORIES in HomePage.jsx
- [ ] Add search bar to marketplace view
- [ ] Test API responses
- [ ] Verify UI rendering of new categories

## Success Criteria
- 17 categories display correctly in sidebar and filter bar
- API returns correct filtered results
- Search works across title, description, tags
- No regressions on existing template functionality
- Cache invalidates properly

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Lucide icon names mismatch | Verify against lucide-react exports |
| Too many categories cluttering sidebar | Group into "Engineering" section |
