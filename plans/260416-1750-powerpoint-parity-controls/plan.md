# Plan: NavSlides Controls — PowerPoint-Parity UX

**Date:** 2026-04-16  
**Status:** Phases 1-3 Complete  
**Slug:** powerpoint-parity-controls  
**Branches:** `feat/controls-ux`

---

## Overview

Cải thiện toàn diện UX controls của NavSlides Editor để đạt mức PowerPoint-parity. Tổng cộng **17 issues** được phân thành **3 phases** trong ~10-14 ngày.

**Report:** `plans/reports/brainstorm-260416-1745-powerpoint-parity-controls-analysis.md`

---

## Phases

| # | Phase | Issues | Priority | Time | Status |
|---|---|---|---|---|---|
| 1 | Critical Fixes | Ctrl+B/I/U bug, Cut/Copy/Paste, Selection Pane | 🔴 P0 | 1-2 days | ✅ Complete |
| 2 | Core Parity | Slide Sorter, Mini Toolbar, Zoom, Toolbar UX | 🟠 P1 | 3-5 days | ✅ Complete |
| 3 | Polish & Advanced | Animation duration, Alignment, Settings split, Context menus, Anim gallery | 🟡 P2-P3 | 5-7 days | ✅ Complete |

**Total estimated time:** 9-14 days

---

## Phase Dependencies

```
Phase 1 ──┬── Phase 2 ── Phase 3
          │
          └── Phase 2 (some tools can parallel)
          └── Phase 3 (some items independent)
```

- Phase 1 là prerequisite cho Phase 2/3 (Selection Pane là nền tảng nhiều features)
- Phase 2 và 3 có thể làm song song với nhau sau Phase 1

---

## Key Files to Modify

| File | Phase | Changes |
|---|---|---|
| `client/src/components/SlideCanvas.jsx` | 1 | Fix Ctrl+B/I/U keyboard, add clipboard events |
| `client/src/stores/editor-store.js` | 1 | Add clipboard state (copy/cut/paste) |
| `client/src/components/PropertiesPanel.jsx` | 1, 2, 3 | Add Selection Pane, Alignment, Fragment section |
| `client/src/pages/EditorPage.jsx` | 2 | Add Slide Sorter mode, Mini Toolbar, Zoom controls |
| `client/src/components/Toolbar.jsx` | 2 | Add tooltips+shortcuts, reorganize layout |
| `client/src/components/AnimationTimeline.jsx` | 3 | Add duration/delay, expand animation types |
| `client/src/components/SlidePanel.jsx` | 2 | Multi-select, Slide Sorter view |

---

## Verification Plan

- Manual testing checklist per phase (Playwright optional)
- Keyboard shortcut test suite: Ctrl+B/I/U, Ctrl+X/C/V, Ctrl+D, Ctrl+Z/Y
- Canvas interaction test: drag, resize, rotate, rubber-band select
- Clipboard test: copy element → paste → verify position + content
- Slide Sorter: drag reorder, multi-select delete

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Ctrl shortcut fix phá vỡ TipTap editor behavior | Medium | Test kỹ trong EditorPage với text element |
| Selection Pane làm Properties Panel quá rộng | Low | Collapsible, default collapsed |
| Animation expansion gây conflict với reveal.js | Medium | Map chỉ những animations reveal.js support |
| Toolbar quá đông sau khi tách lại | Low | Reorganize trước khi test |

---

## Unresolved Questions (from brainstorm)

1. **Clipboard format**: Copy/Paste elements → JSON hay HTML?
2. **Slide Sorter**: Full-screen overlay hay inline grid?
3. **Selection Pane**: Properties Panel hay floating panel?
4. **Animation gallery**: Map sang reveal.js auto-animate ra sao?

---

## Next Steps

→ Review Phase 1 plan → `phase-01-critical-fixes.md`  
→ Review Phase 2 plan → `phase-02-core-parity.md`  
→ Review Phase 3 plan → `phase-03-polish-advanced.md`

 Sau khi approve → implement Phase 1 → Phase 2 → Phase 3.