# Tailwind Inline-Style Elimination — Complete Migration

> **Source:** [Verification Report](file:///C:/Users/Z10PAD8C_Xuan2261/.gemini/antigravity/brain/e3ed702e-1e71-4bf4-af6d-99936ec21db8/verification_code_review.md)

## Completion Status

- Status: Completed on 2026-04-23
- `client/src` literal inline-style count: `503` baseline -> `27`
- `SlideCanvas.jsx` literal inline-style count: `68` hotspot baseline -> `13`
- Legacy migrated-surface classes removed: `qat-dot`, `anim-fade-in`, `anim-zoom-in`
- Verification passed: `npm run build`, `npm run test`, `npm run test:e2e`, `npx vitest run client/src/utils/tailwind-inline-style-audit.test.js`

## Scope

- **503** inline `style={{}}` across codebase → target: ≤ 30 (dynamic-only exceptions)
- **296** hardcoded hex colors → target: 0 in UI code (data-only exceptions allowed)
- **39 files** affected → organized into 5 phases by priority/risk

## Exclusions (Keep As-Is)

These inline styles are **intentional and correct** — do NOT convert:

1. **`TransitionPreview.jsx`** iframe HTML string — `!important` overrides for Reveal.js inside iframe sandbox
2. **`HomePage.jsx` `PRESET_THEMES`** — hex colors are **data values** mapping to Reveal.js themes, not UI styling
3. **Dynamic position/transform styles** — `left: ${x}%`, `transform: scale(...)` that depend on runtime state
4. **`SlideCanvas.jsx` element rendering** — canvas elements positioned via computed `x`, `y`, `width`, `height`

## Phase Overview

| Phase | Focus | Files | Est. Inline→0 | Priority |
|---|---|---|---|---|
| 01 | Full-page rewrites (zero Tailwind adoption) | SpeakerViewPage, LiveViewPage | ~46 → 6 | P1 |
| 02 | Properties Panel family | misc, image, table, chart, code, media, common | ~114 → 5 | P1 |
| 03 | Core editor components | Toolbar, SlidePanel, InsertMenu, AnimationTimeline | ~109 → 15 | P2 |
| 04 | Dashboard & supporting | TemplatePreview, TemplatePickerModal, ProductTour, others | ~90 → 3 | P2 |
| 05 | SlideCanvas + Config cleanup | SlideCanvas (selective), index.css, tailwind.config.js | ~30 → ≤5 | P3 |

## Verification Strategy

Each phase follows: **Migrate → Build → Visual Check → E2E**

```
1. npm run build             # zero errors, zero warnings
2. npm run dev               # browser visual check
3. npm run test:e2e          # playwright E2E suite
4. grep count verification   # style={{ count must decrease
```

## Phases

- [Phase 01](file:///d:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/plans/20260423-0811-tailwind-inline-style-elimination/phase-01-fullpage-rewrites.md) — Full-Page Rewrites
- [Phase 02](file:///d:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/plans/20260423-0811-tailwind-inline-style-elimination/phase-02-properties-panel.md) — Properties Panel Family
- [Phase 03](file:///d:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/plans/20260423-0811-tailwind-inline-style-elimination/phase-03-core-editor.md) — Core Editor Components
- [Phase 04](file:///d:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/plans/20260423-0811-tailwind-inline-style-elimination/phase-04-dashboard-support.md) — Dashboard & Supporting
- [Phase 05](file:///d:/NCKH_2025/Para_WorkSpace/NavSlidesEditor/Projects/NavSlidesEditor/repo/plans/20260423-0811-tailwind-inline-style-elimination/phase-05-canvas-config.md) — SlideCanvas + Config Cleanup
