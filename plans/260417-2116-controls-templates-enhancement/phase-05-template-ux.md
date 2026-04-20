# Phase 5: Template UX Enhancement

## Context
- [TemplateGallery.jsx](file:///d:/NCKH_2025/revealjs_gui/client/src/components/dashboard/TemplateGallery.jsx) — Marketplace gallery UI
- [EditorPage.jsx:3421-3600](file:///d:/NCKH_2025/revealjs_gui/client/src/pages/EditorPage.jsx#L3421-L3600) — Slide template modal

## Overview
- Priority: P1
- Status: ✅ Completed
- Cải tiến UX cho template system: preview modal, "Insert Slides" flow, favorites

## Requirements

### Functional
1. **Template Preview Modal**: Khi click template trong Marketplace → show slide carousel preview
2. **"Insert Slides" Flow**: Option "Insert into current presentation" thay vì chỉ "Create new"
3. **Favorites System**: Star/unstar templates, lưu localStorage, tab "My Favorites"
4. **Sort & Filter**: Sort by difficulty, filter by interactive/quiz/lecture tags
5. **Template Info Badge**: Show slide count, interactive badge, difficulty level

### Non-Functional
- Preview modal render actual slide content (miniature)
- Responsive modal (min 600px width)
- LocalStorage for favorites (no server dependency)
- Smooth transitions/animations

## Architecture

### Template Preview Modal
```
┌─────────────────────────────────────────────────────┐
│ ← Template Title                         ⭐ ✕      │
│─────────────────────────────────────────────────────│
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │                                             │    │
│  │         Slide Preview (miniature)           │    │
│  │           960×540 scaled to fit             │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│        ◀  Slide 2 / 8  ▶                           │
│                                                     │
│  📋 8 slides  ⚡ Interactive  📊 Medium             │
│  Tags: digital-electronics, simulation              │
│                                                     │
│  ┌──────────────┐  ┌──────────────────────────┐    │
│  │ Use as New   │  │ Insert into Current Pres │    │
│  └──────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Favorites Storage
```js
// localStorage key: 'navslides-favorite-templates'
// Value: JSON array of template IDs
['sim-ohm-law', 'quiz-multiple-choice', 'digi-lecture-overview']
```

### Insert Slides Flow
1. User clicks "Insert into Current Presentation"
2. Show slide selector: checkboxes for each slide in template
3. User selects slides to insert
4. Position selector: "After current slide" or "At end"
5. Insert selected slides with new UUIDs

## Related Code Files

### Create
- `client/src/components/dashboard/TemplatePreviewModal.jsx` — Preview modal component

### Modify
- `client/src/components/dashboard/TemplateGallery.jsx` — Add preview on click, favorites tab, sorting
- `client/src/pages/EditorPage.jsx` — Add `insertSlidesFromTemplate()` function for insert flow

## Implementation Steps

1. **Create TemplatePreviewModal.jsx**
   - Props: `template`, `onClose`, `onUseAsNew`, `onInsertSlides`, `isFavorite`, `onToggleFavorite`
   - Slide carousel: render miniature slide elements (text + shapes only, skip html/chart iframes)
   - Navigation: prev/next buttons, slide counter
   - Metadata display: slide count, tags, difficulty, interactive badge
   - Two action buttons: "Use as New" + "Insert into Current"

2. **Add Favorites system to TemplateGallery**
   - "⭐ Favorites" tab alongside category tabs
   - Star icon on each template card (toggle on/off)
   - `useFavorites()` custom hook — reads/writes localStorage
   - Favorites tab shows only starred templates

3. **Add Sort & Filter**
   - Sort dropdown: "Newest", "Difficulty", "Slide Count"
   - Filter chips: "Interactive ⚡", "Quiz ❓", "Lecture 📖"
   - Applied filters shown as removable badges

4. **Implement Insert Slides flow**
   - In TemplatePreviewModal: "Insert" button opens slide selector panel
   - Checkboxes for each slide (with mini preview)
   - "Select All" / "Deselect All" buttons
   - Position: radio "After current slide" / "At end"
   - `insertSlidesFromTemplate(templateSlides, position)` function in EditorPage

5. **Add Template Info Badges to gallery cards**
   - Bottom of each card: `📋 N slides` + `⚡ Interactive` badge (if has html elements)
   - Difficulty: `🟢 Basic` | `🟡 Intermediate` | `🔴 Advanced`

## Todo List

- [x] Create TemplatePreviewModal.jsx component
- [x] Implement miniature slide renderer (text + shape elements)
- [x] Add slide carousel navigation (prev/next)
- [x] Add template metadata display
- [x] Implement Favorites system (localStorage)
- [x] Add ⭐ Favorites tab to TemplateGallery
- [x] Add sort dropdown (difficulty, slide count)
- [x] Add filter chips (interactive, quiz, lecture)
- [x] Implement "Insert Slides" flow in preview modal
- [x] Add insertSlidesFromTemplate() to EditorPage
- [x] Add info badges to gallery cards
- [x] Style improvements (smooth transitions, hover effects)
- [x] Build test

## Success Criteria
- ✅ Click template → preview modal with slide carousel
- ✅ Navigate between slides in preview
- ✅ Star/unstar templates, Favorites tab works
- ✅ Sort and filter functional
- ✅ "Insert Slides" adds selected slides to current presentation
- ✅ Info badges visible on template cards
- ✅ Build passes, no errors

## Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| Miniature preview can't render html/iframe | Low | Show placeholder for html/chart elements |
| localStorage quota | Very Low | Template IDs are tiny |
| Insert flow breaks slide ordering | Medium | Reindex zIndex + regenerate all element IDs |
