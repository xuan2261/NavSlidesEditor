# Deep Technical Dive: Slide Master / Reusable Layout Templates for NavSlidesEditor

**Date:** 2026-04-26
**Author:** brainstormer agent

---

## 1. Current Template System Analysis

### 1.1 How Templates Are Defined

Current system lives in `client/src/data/slide-templates.js` as a static `SLIDE_TEMPLATES` object with **19 built-in templates** across 4 categories: basic, content, layout, ending.

Each template is a plain object with:

``` js
{
  label: `Title Slide`,
  icon: `T`,
  category: `basic`,
  elements: [
    { type: `text`, x: 80, y: 160, width: 800, height: 120, zIndex: 1, content: `<h1>...</h1>` },
  ]
}
```

**No background inheritance.** Templates define their own backgrounds implicitly via element fills.

### 1.2 Slide Creation Flow

`use-slide-operations.js` exposes `addSlide(templateKey)` which:

1. Looks up template by key from `SLIDE_TEMPLATES`
2. Deep-clones elements with `uuid()` ID generation
3. Inherits `background` from the previous slide (the only inheritance that exists today)
4. Pushes to `presentation.slides[]`

### 1.3 Data Model Gap

From `shared/src/types/presentation.js`:

``` js
Slide:   { id, elements[], notes, background, hidden, showPageNumber, fragments[] }
Presentation: { id, title, theme, transition, slides[], footer, presenterTools, isTemplate, ... }
```

**No `masterId` or `layoutId` field on Slide.** `isTemplate` exists only at Presentation level and means this presentation is a template -- not this slide is a layout derived from a master.

### 1.4 Template Picker UX

`TemplatePickerModal.jsx` shows a 4-column grid grouped by category. Selecting a template triggers `addSlide(key)`.
No user-saveable templates. No master/layout distinction. No propagation.

### 1.5 Leverageable Existing Infrastructure

- `showMasterPanel` state reserved at `EditorPage.jsx:187`
- `background` inheritance in `addSlide()` -- pattern to extend
- `SlidePanel.jsx` thumbnail rendering with percentage-based positioning
- `getPreviewElementStyle()` -- already handles relative positioning
- `zIndex` on elements -- foundation for layering strategy
- `shared/src/htmlGenerator.js` -- render pipeline that can be extended to merge master content

---
## 2. Research: What is Slide Master?
 
### 2.1 PowerPoint Model (Reference Standard)
 
| Concept | Description |
|---------|-------------|
| **Slide Master** | Hidden slide at root of hierarchy. Contains backgrounds, headers, footers, logos, default fonts. Changes cascade to all linked slides. |
| **Layout** | Named arrangement of placeholders (title, body, image). Linked to one master. Slides link to a layout. |
| **Theme** | Colors, fonts, effects applied to master. |
| **Slide** | Actual content. Inherits from master + layout. Can override background, text formatting, element visibility. |
 
### 2.2 Google Slides / Canva Model (Simpler)
 
Google Slides and Canva take a simpler approach: Save as template creates a snapshot copy. No live propagation.
 
### 2.3 Figma / Component Pattern (Web Frontend)
 
Closest web frontend analog: component with **variants** and **overrides**.
 
```
Component (Master)
  + Variant A (Layout)
    + Instance 1 (Slide)
    + Instance 2 (Slide)
  + Variant B (Layout)
    + Instance 3 (Slide)
```
 
**Key insight**: Figma instances can detach from component -- same as break from master.
 
### 2.4 Reveal.js Constraints
 
Reveal.js 5.x has no built-in master concept. CSS-based theming via `Reveal.initialize({ theme: ... })`.
 
- `<section data-background-*>` attributes for per-slide backgrounds
- No concept of master slides, layouts, or content inheritance
- Must implement in JSON data model and resolve at render/export time
 
**Key constraint**: All inheritance/resolution must happen in client-side rendering and export pipelines -- not in reveal.js itself.
 
---
## 3. Options Analysis
 
### Option A: Masters are just slides (One-level)
 
**Concept**: A Master is a `type: `master` `slide`. A normal slide optionally links to one master. At render time, merge master elements into slide elements.
 
**Pros**:
- Simplest implementation -- masters live in same data model as slides
- UI can reuse existing SlidePanel and canvas rendering
- No new concepts to learn
- Easy export: resolve before writing PPTX/HTML
 
**Cons**:
- No layout abstraction -- all master content lands on every slide equally
- No named placeholder slots
- Master edits affect ALL linked slides (may be unexpected)
 
### Option B: Full Master -> Layout -> Slide chain
 
**Concept**: Mimic PowerPoint exactly: Master -> Layout -> Slide with three-level hierarchy.
 
**Pros**:
- Matches PowerPoint user expectations exactly
- Richest capability: named placeholders, multiple layouts per master
- Industry standard
 
**Cons**:
- Complex data model -- three new types
- Significant UI work: master editor, layout editor, slide editor modes
- 3x the state management complexity
- Overkill for typical presentation use cases
- High implementation risk
 
### Option C: Hybrid -- Masters with Layout Variants (Recommended)
 
**Concept**: Master slide + named layout variants within it. Slides link to master+layout. One-level chain but supports multiple named arrangements.
 
```
Master Slide (invisible)
  + Layout: Title Layout     <- default for new slides
  + Layout: Content Layout
  + Layout: Two-Column Layout
  + Layout: Section Header
 
Normal Slide A -> links to Master, layout: Content Layout
Normal Slide B -> links to Master, layout: Title Layout
```
 
**Pros**:
- Close to PowerPoint semantics without full three-level complexity
- Layout variants stored as named sections within master slide data
- Masters managed separately from slides (Master Editor mode)
- Reasonable scope -- achievable in ~5 weeks
 
**Cons**:
- Layout editing still requires master edit mode (extra UI complexity)
- Migration path from current flat system
 
### Comparison Matrix
 
| Dimension | Option A | Option B | Option C |
|:----------|:---------|:---------|:---------|
| Implementation complexity | Low | Very High | Medium |
| User capability | Basic | Full | Comprehensive |
| Data model changes | Minor | Major | Moderate |
| UI complexity | Low | High | Medium |
| Export impact | Low | High | Medium |
| Risk | Low | High | Medium |
| Time estimate | 2-3 weeks | 10+ weeks | 5 weeks |
| Matches user mental model | Partial | Exact | Near-exact |
 
---
## 4. Recommended Approach: Option C -- Hybrid
 
### Rationale
 
Option C provides the best capability-to-complexity ratio for a v1 implementation:
 
1. **Masters are slides** -- reuses existing infrastructure (rendering, store, export)
2. **Layouts are named variants** -- no separate type, just a `layoutKey` string on slides
3. **Master editing in separate mode** -- safe editing without cluttering normal workflow
4. **Propagation with override** -- users can break from master when needed (Figma pattern)
5. **Achievable in 5 weeks** -- fits typical sprint cycles
 
### Key Design Decisions
 
| Decision | Choice |
|:---------|:-------|
| Master storage | Presentation-level array `presentation.masters[]` |
| Slide linking | `slide.masterId` + `slide.layoutKey` fields |
| Inheritance resolution | Runtime merge in render layer (not stored) |
| Override mechanism | Per-element `overrideFromMaster: true` flag |
| Break from master | Promote master elements to explicit slide elements |
| Z-index strategy | Master: 1-999, Slide: 1000+ |
 
---
## 5. Data Model Design

### 5.1 New Types

``` js
// In shared/src/types/presentation.js

// Layout variant: named arrangement within a master
LayoutVariant {
  key: string           // e.g., title-layout, content-layout
  label: string          // e.g., Title Slide, Two Column
  elementOverrides: PartialElement[]  // placeholder definitions
  inheritedElementIds: string[]  // which master elements are shown
}

// Slide Master: special slide with layout variants
SlideMaster {
  id: string
  name: string
  background: Background
  elements: Element[]        // base elements (1-999 zIndex)
  layouts: LayoutVariant[]  // named layout configurations
  createdAt: string
  updatedAt: string
}

// Extend Slide type
Slide {
  // ... existing fields ...
  masterId: string         // links to SlideMaster.id
  layoutKey: string        // links to LayoutVariant.key
  overrides: {
    elementId: Partial<Element>  // per-element overrides
  }
  brokenFromMaster: boolean  // true = no longer inherits
}

// Extend Presentation type
Presentation {
  // ... existing fields ...
  masters: SlideMaster[]
}
```

### 5.2 Resolution Function

``` js
// client/src/utils/resolve-slide-master.js

export function resolveSlideContent(slide, masters) {
  if (slide.brokenFromMaster) return slide.elements
  if (!slide.masterId) return slide.elements

  const master = masters.find(m => m.id === slide.masterId)
  if (!master) return slide.elements

  const layout = master.layouts.find(l => l.key === slide.layoutKey)
  if (!layout) return mergeMasterElements(master.elements, slide.elements)

  return mergeMasterWithLayout(master, layout, slide)
}

function mergeMasterWithLayout(master, layout, slide) {
  // 1. Start with master base elements (zIndex 1-999)
  // 2. Apply layout element visibility overrides
  // 3. Merge slide.elementOverrides on top
  // 4. Return resolved element array
}
```

### 5.3 Break from Master

``` js
export function breakFromMaster(slide, master) {
  const resolved = resolveSlideContent(slide, [master])
  return {
    ...slide,
    elements: resolved.map(el => ({ ...el, id: generateId() })), // re-ID so they are now slide-owned
    masterId: undefined,
    layoutKey: undefined,
    brokenFromMaster: true,
  }
}
```

### 5.4 Z-Index Strategy

- Master elements: `zIndex` in range 1-999 (reserved)
- Slide elements: `zIndex` in range 1000+ (user-owned)
- This prevents conflicts when merging -- master elements always render below slide content

### 5.5 Server Storage

Masters stored within the Presentation JSON (no separate endpoint needed):

``` js
// POST /api/presentations -- body includes masters[]
{
  id: "pres_123",
  title: "My Deck",
  slides: [...],
  masters: [
    { id: "master_1", name: "Brand Master", layouts: [...], elements: [...] }
  ]
}
```

---
## 6. UI/UX Design

### 6.1 Access Points

| Action | Location | Result |
|:-------|:---------|:-------|
| View Masters | View menu -> Slide Masters | Opens Master Panel (sidebar) |
| Create Master | Master Panel -> New Master | Creates blank master, opens Master Edit Mode |
| Apply Master | Slide Panel -> context menu -> Apply Master | Opens master picker dialog |
| Edit Master | Master Panel -> double-click master | Opens Master Edit Mode |
| Edit Layout | Master Edit Mode -> layout tab bar | Edit layout variant |
| Break from Master | Slide context menu -> Break from Master | Detaches slide, promotes elements |

### 6.2 Master Panel (Sidebar)

New sidebar panel showing master thumbnails:

```
+---------------------+
| Slide Masters    [X]|
+---------------------+
| + New Master        |
+---------------------+
| | Master 1           ||
| | [thumb] [rename]   ||
+---------------------+|
| | Master 2           ||
| | [thumb] [rename]   ||
+---------------------+
```

Bottom-anchored, 240px wide, shares space with SlidePanel via tabs.

### 6.3 Master Edit Mode

When editing a master:

1. **Canvas shows master preview** -- all slides using this master are dimmed/ghosted in background
2. **Layout tab bar** -- tabs for each layout variant, + to add new layout
3. **Toolbar restricted** -- Insert + Format allowed, Slide operations hidden
4. **Side panel** -- shows master properties (name, background, layouts)
5. **Banner** -- Editing Master: [Name] | [Exit Master Edit]

### 6.4 Slide-Level Controls

In SlidePanel, slides linked to a master show:

- Master badge icon + master name tooltip
- Layout name label
- Context menu: Edit Master, Change Layout, Break from Master

### 6.5 Visual Indicators

- Canvas: linked slides show faint master ghost overlay when selected
- SlidePanel: master badge on thumbnails
- Toolbar: master link status in footer area
- Master panel: active master highlighted

### 6.6 Existing `showMasterPanel` State

`EditorPage.jsx:187` already reserves `const [showMasterPanel, setShowMasterPanel] = useState(false)`. This confirms prior design intent. The new work is wiring it to actual functionality.

---
## 7. Technical Implementation Steps

### Phase 1: Data Model (Week 1) ~3 days

1. Add `SlideMaster`, `LayoutVariant`, `Slide.masterId/layoutKey/overrides/brokenFromMaster` to `shared/src/types/presentation.js`
2. Add `masters: []` to `Presentation` type
3. Create `client/src/utils/resolve-slide-master.js` with `resolveSlideContent()` and `breakFromMaster()`
4. Write unit tests for resolution logic

### Phase 2: Store & State (Week 1-2) ~3 days

1. Add master CRUD operations to `presentation-store.js`: `addMaster`, `updateMaster`, `deleteMaster`, `applyMasterToSlide`, `breakSlideFromMaster`
2. Add `masters[]` to `setPresentation` / initial state
3. Update `use-slide-operations.js` to handle master-linked slide creation
4. Update `addSlide()` to optionally accept `masterId` + `layoutKey`

### Phase 3: Rendering Pipeline (Week 2) ~4 days

1. Update `SlideCanvas.jsx` to call `resolveSlideContent()` when rendering linked slides
2. Update `SlidePanel.jsx` thumbnail rendering to show resolved content
3. Update `SlideSorterView.jsx` thumbnails
4. Update `shared/src/htmlGenerator.js` to inline resolved content (for shareable links and server-side rendering)

### Phase 4: UI Components (Week 2-3) ~5 days

1. Build `MasterPanel.jsx` -- sidebar with master thumbnails, create/rename/delete
2. Build `MasterEditor.jsx` -- full-canvas master editing mode
3. Build `LayoutTabBar.jsx` -- layout variant tabs within master editor
4. Build `MasterPickerModal.jsx` -- dialog to select and preview master+layout when applying
5. Build `SlideMasterBadge.jsx` -- visual indicator on slide thumbnails
6. Add context menu items to `SlidePanel.jsx`: Apply Master, Edit Master, Break from Master
7. Wire `showMasterPanel` state in `EditorPage.jsx` to new MasterPanel component

### Phase 5: Export & Migration (Week 3-4) ~4 days

1. Update `export-pptx-core.js`: resolve master content before rendering each slide
2. Update `export-pptx-basic-renderers.js` to handle resolved elements
3. Update `exportPptx.js` orchestration
4. Update `shared/src/htmlGenerator.js` for resolved content in HTML export
5. Add migration for existing presentations (add empty `masters: []` on load)
6. Update `import-project.js` to handle master data on import
7. Build default masters: Corporate and Minimal starters shipped with app

### Phase 6: Polish & Testing (Week 4-5) ~4 days

1. Integration tests: create master -> apply to slides -> verify inheritance -> break -> verify independence
2. Export tests: PPTX export with master-linked slides
3. UX testing: master editing flow, layout switching
4. Performance: test presentation with 50 slides all linked to same master
5. Documentation: update user docs, changelog

**Total estimate: ~5 weeks**

---
## 8. Impact on Export

### 8.1 PPTX Export

**Approach**: Resolve master content BEFORE passing to pptxgenjs.

``` js
// export-pptx-core.js
async function renderSlideToPptx(slide, presentation) {
  const resolved = resolveSlideContent(slide, presentation.masters || [])
  for (const element of resolved) {
    await renderElement(element, slide.background, pptx)
  }
}
```

**Impact**: LOW. Resolution happens in JS before pptxgenjs sees it. No changes to rendering functions needed.

### 8.2 HTML / Reveal.js Export

**Approach**: `shared/src/htmlGenerator.js` resolves masters at generation time.

``` js
function generateSlideHtml(slide, presentation) {
  const resolved = resolveSlideContent(slide, presentation.masters || [])
  return buildSectionHtml(resolved, slide.background)
}
```

**Impact**: MEDIUM. Need to thread `masters` through `generatePresentationHtml()`. Already passes `theme` and other presentation-level data -- masters fit the same pattern.

### 8.3 Project File (Save/Load)

Masters stored within presentation JSON. Save/load is transparent -- no changes needed.

### 8.4 PDF Export

PDF is generated from HTML export. Master resolution in HTML generation covers this automatically.

### 8.5 Offline Export

`client/src/utils/offlineExport.js` renders reveal.js HTML. Same as HTML export -- masters resolved in generation.

---
## 9. Effort Estimate & Risks

### 9.1 Effort Summary

| Phase | Tasks | Days |
|:------|:------|:-----|
| Data Model | Types, resolution function, unit tests | 3 |
| Store & State | Store ops, use-slide-operations | 3 |
| Rendering Pipeline | Canvas, panel, sorter, htmlGenerator | 4 |
| UI Components | Panel, editor, modals, badges | 5 |
| Export & Migration | PPTX, HTML, migration, defaults | 4 |
| Polish & Testing | Integration tests, UX, perf, docs | 4 |
| **Total** | | **~23 days** |

### 9.2 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|:-----|:-----------|:-------|:-----------|
| Resolution conflicts with element IDs | Medium | High | Re-ID elements on break; use stable internal IDs |
| Performance degradation with many master-linked slides | Medium | Medium | Memoize `resolveSlideContent()`; virtualize SlidePanel |
| Master editing UX confusion | Medium | Medium | Clear visual mode indicator; guided onboarding |
| Export round-trip fidelity loss | Low | High | Comprehensive test matrix for each export type |
| Z-index collision between master/slide elements | Low | Medium | Enforce range contract; validate on slide link |
| Breaking existing presentations (migration) | Low | High | Add empty `masters: []` gracefully; no schema migrations |
| Scope creep (users want PowerPoint-exact features) | High | Medium | Define v1 scope strictly; defer layouts-on-layouts to v2 |

### 9.3 Open Questions

1. **Should master changes propagate to already-linked slides automatically, or require user confirmation?** PowerPoint does auto-propagate; Google Slides does not. Recommend: auto-propagate with undo support, option to break per-slide.

2. **Should users be able to create layouts within a master via drag-and-drop, or only via template selection?** Recommendation: start with template-based layout creation; drag-and-drop layout building is a v2 feature.

3. **How should master elements be edited when some slides have overridden them?** Show overridden elements as dimmed with Overridden badge. Editing master affects the base, not the override.

4. **Should masters support nested hierarchy (master of masters)?** No. Keep one level. Nested masters add complexity without practical benefit for presentations.

5. **How do themes interact with masters?** Themes set colors/fonts at presentation level. Masters inherit theme settings but can override. Master backgrounds are independent of theme backgrounds. Recommendation: document this clearly in UX.