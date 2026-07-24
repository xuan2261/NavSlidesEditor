# Phase 10: Deferred High-Risk Items — Planning Only

**Priority:** P2
**Status:** pending
**Effort:** 3-4h (planning only, no implementation)

---

## Context Links

- [Predict Report](predict-report-5-expert-personas-debate.md) — Persona 5: deferred items have hidden dependencies
- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.6
- [Existing Timeline Plan](../260514-1350-timeline-element-p2-plan/)
- [Existing Plugin Plan](../260514-1350-plugin-manim-architecture-epic/)

## Overview

Create detailed implementation plans for the 3 high-risk item groups deferred from this port. NOT implemented — only planned.

## Per Persona 5 Warning

"These are not greenfield features — they are existing code that upstream may have changed. Deferring them means the port may create inconsistencies." — Verify that existing local code for Timeline, Plugin, and Citation still works after Phases 2-7.

## Deferred Items

### 1. Timeline Element (16-23h)
**Upstream commits:** `9d3288ea` + 9 commits
**Risk:** Schema change, new renderer, name collision with `AnimationTimeline`

**Planning tasks:**
- Read all 10 upstream commits
- Design schema extension for timeline element type
- Design renderer for present mode
- Resolve name collision: `AnimationTimeline` (React component) vs `Timeline` (slide element)
- Design properties panel
- Create plan at `plans/XXXXXXXX-timeline-element-implementation/`

### 2. Plugin Architecture + Manim (42-66h)
**Upstream commits:** `e37311be` + 9 commits
**Risk:** Trust boundary, storage rewrite, sandbox, export hooks

**Planning tasks:**
- Read all 10 upstream commits
- Design trust model for self-hosted (no Clerk auth)
- Design plugin storage (file-based)
- Design sandbox for plugin execution
- Security threat modeling
- Create plan at `plans/XXXXXXXX-plugin-architecture-epic/`

### 3. Image Citation Controls (8-12h)
**Upstream commits:** `0e7196b6` + 3 commits
**Risk:** Schema extension for `ImageElement`

**Planning tasks:**
- Read all 4 upstream commits
- Design schema: `citationText`, `citationLink` fields
- Design UI in properties panel
- Design present mode rendering
- Create plan at `plans/XXXXXXXX-image-citation-controls/`

## Post-Port Verification

After Phases 2-7 are complete, verify existing code still works:
1. `timeline-element-renderer.jsx` — still renders correctly
2. `timeline-properties.jsx` — still shows properties
3. `presenterTools.js` — plugin references still valid
4. `buildCitationHtml()` in `element-renderers.js` — citation HTML still correct

## Todo List

- [ ] Verify existing Timeline code works after port
- [ ] Verify existing Plugin references work after port
- [ ] Verify existing Citation code works after port
- [ ] Read all Timeline upstream commits
- [ ] Create Timeline element implementation plan
- [ ] Read all Plugin upstream commits
- [ ] Create Plugin architecture implementation plan
- [ ] Read all Citation upstream commits
- [ ] Create Image citation implementation plan
- [ ] Update development roadmap with deferred items

## Success Criteria

- 3 detailed implementation plans created
- Each plan has phases, file lists, risk assessment, acceptance criteria
- Existing local code verified to still work after low/medium port
- Development roadmap updated
