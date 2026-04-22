# Phase 06: UI Enhancement & Polish

## Context Links

- [TemplateGallery.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/components/dashboard/TemplateGallery.jsx)
- [TemplatePreview.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/dashboard/TemplatePreview.jsx)
- [HomePage.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/HomePage.jsx)
- [index.css](file:///d:/NCKH_2025/revealjs_gui/client/src/index.css)

## Overview

- **Priority:** P1
- **Status:** ⬜ Pending
- **Effort:** 1-2 ngày
- **Depends on:** Phase 01 + at least Phase 02
- Cải thiện UI/UX cho Template Gallery để xử lý 45+ templates hiệu quả.

## Requirements

### Functional

1. **Search bar** trong marketplace view — filter by title/description/tags
2. **Category grouping** — nhóm categories thành sections (Engineering, General)
3. **Template preview** — render mini slide preview thay vì gradient box
4. **Template count badge** — hiển thị số templates mỗi category
5. **Tag chips** — hiển thị tags dưới mỗi template card
6. **Difficulty badge** — hiển thị level (cơ bản/trung cấp/nâng cao)
7. **"Interactive" badge** — đánh dấu templates có simulation

### Non-functional

- Smooth scrolling cho 45+ items
- Animations cho filter transitions

---

## Implementation Steps

### Step 1: Category Grouping in Sidebar (30 min)

Trong HomePage marketplace sidebar, nhóm categories:

```jsx
// HomePage.jsx marketplace section
const CATEGORY_GROUPS = [
  {
    label: 'Kỹ thuật',
    categories: [
      'digital-electronics',
      'microprocessor',
      'circuit-theory',
      'electronics',
      'automation',
      'electrical',
      'measurement',
      'power-electronics',
      'mechanical',
      'technical-drawing',
      'fluid-mechanics',
    ],
  },
  {
    label: 'Chung',
    categories: ['military', 'academic', 'corporate', 'creative'],
  },
]
```

Render grouped:

```jsx
{
  CATEGORY_GROUPS.map((group) => (
    <div key={group.label}>
      <div className="sidebar-section-title">{group.label}</div>
      {group.categories.map((catId) => {
        const cat = marketplaceData.categories.find((c) => c.id === catId)
        if (!cat) return null
        const count = marketplaceData.templates.filter((t) => t.category === catId).length
        return (
          <button
            key={catId}
            className={`template-category-btn ${marketplaceCategory === catId ? 'active' : ''}`}
            onClick={() => setMarketplaceCategory(catId)}
          >
            {cat.name}
            {count > 0 && <span className="category-count">{count}</span>}
          </button>
        )
      })}
    </div>
  ))
}
```

### Step 2: Search Bar (30 min)

Add search input above marketplace grid:

```jsx
const [marketSearch, setMarketSearch] = useState('')

// In marketplace view:
;<div className="home-search" style={{ marginBottom: 16 }}>
  <Search size={15} className="home-search-icon" />
  <input
    className="home-search-input"
    placeholder="Tìm template..."
    value={marketSearch}
    onChange={(e) => setMarketSearch(e.target.value)}
  />
</div>

// Filter logic:
const filteredMarketplace = useMemo(() => {
  let items = marketplaceData.templates
  if (marketplaceCategory) items = items.filter((t) => t.category === marketplaceCategory)
  if (marketSearch.trim()) {
    const q = marketSearch.toLowerCase()
    items = items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.includes(q))
    )
  }
  return items
}, [marketplaceData.templates, marketplaceCategory, marketSearch])
```

### Step 3: Enhanced Template Cards (45 min)

Cập nhật template card trong marketplace grid:

```jsx
<div className="card-info">
  <h3>{tmpl.title}</h3>
  <p>{tmpl.description}</p>
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
    {/* Difficulty badge */}
    {tmpl.difficulty && (
      <span
        className="template-badge"
        style={{
          background:
            tmpl.difficulty === 'advanced'
              ? '#ff475720'
              : tmpl.difficulty === 'intermediate'
                ? '#ffd70020'
                : '#00ff8720',
          color:
            tmpl.difficulty === 'advanced'
              ? '#ff4757'
              : tmpl.difficulty === 'intermediate'
                ? '#ffd700'
                : '#00ff87',
        }}
      >
        {tmpl.difficulty === 'advanced'
          ? 'Nâng cao'
          : tmpl.difficulty === 'intermediate'
            ? 'Trung cấp'
            : 'Cơ bản'}
      </span>
    )}
    {/* Interactive badge */}
    {(tmpl.tags || []).includes('interactive') && (
      <span className="template-badge" style={{ background: '#00d4ff20', color: '#00d4ff' }}>
        ⚡ Tương tác
      </span>
    )}
    {/* Slide count */}
    <span className="template-badge">{tmpl.slides?.length || 0} slides</span>
  </div>
</div>
```

### Step 4: CSS cho badges & new components (20 min)

```css
/* index.css additions */
.template-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  background: var(--bg-hover);
  color: var(--text-muted);
  gap: 3px;
}

.category-count {
  margin-left: auto;
  background: var(--bg-hover);
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
}

.template-category-btn {
  display: flex;
  align-items: center;
  width: 100%;
  text-align: left;
  gap: 6px;
}
```

### Step 5: Improve TemplatePreview Modal (30 min)

Hiển thị thêm metadata trong preview:

```jsx
// TemplatePreview.jsx — enhance with:
<div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
  {template.tags?.map(tag => (
    <span key={tag} className="template-badge">{tag}</span>
  ))}
</div>
<div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>
  <span>📄 {template.slides?.length || 0} slides</span>
  <span>📁 {template.category}</span>
  {template.difficulty && <span>📊 {template.difficulty}</span>}
</div>
```

### Step 6: Color-coded Category Thumbnails (20 min)

Template cards dùng gradient từ subject color scheme thay vì generic gradient:

```javascript
// Trong marketplace card rendering:
const bgStyle = tmpl.colorScheme
  ? {
      background: `linear-gradient(135deg, ${tmpl.colorScheme.background}, ${tmpl.colorScheme.primary}20)`,
    }
  : tmpl.thumbnail?.gradient
    ? { background: tmpl.thumbnail.gradient }
    : { backgroundColor: '#2d3748' }
```

### Step 7: Test & Polish (30 min)

- 45+ templates render without lag
- Search filters correctly
- Category grouping looks good
- Badges display properly
- Preview modal shows all metadata

## Todo List

- [ ] Category grouping in sidebar
- [ ] Search bar for marketplace
- [ ] Enhanced template cards with badges
- [ ] CSS for badges & new components
- [ ] Improved TemplatePreview modal
- [ ] Color-coded category thumbnails
- [ ] Test with 45+ templates
- [ ] Polish animations & transitions

## Success Criteria

- Search works across title/description/tags
- Category sidebar groups "Kỹ thuật" vs "Chung"
- Difficulty badges colored correctly
- "Interactive" badge shows on simulation templates
- Template count per category visible
- No UI lag with 45+ templates
- TemplatePreview shows tags, slides count, category metadata
