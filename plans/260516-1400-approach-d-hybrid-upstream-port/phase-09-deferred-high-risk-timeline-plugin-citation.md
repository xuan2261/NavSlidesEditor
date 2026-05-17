# Phase 9: Deferred High-Risk Items — Planning Only

**Priority:** P2
**Status:** pending
**Effort:** 3-4h (planning only, no implementation)

---

## Context Links

- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.6
- [Overview Plan](hybrid-upstream-port-overview-plan.md)
- [Existing Timeline Plan](../260514-1350-timeline-element-p2-plan/)
- [Existing Plugin Plan](../260514-1350-plugin-manim-architecture-epic/)

## Overview

Create detailed implementation plans for the 3 high-risk item groups that were deferred from this port. These are NOT implemented in this phase — only planned.

## Deferred Items

### 1. Timeline Element (16-23h)
**Upstream commits:** `9d3288ea` + 9 commits
**Risk:** Schema change, new renderer, name collision with `AnimationTimeline`

**Planning tasks:**
- Read all 10 upstream commits to understand full feature scope
- Design schema extension for timeline element type
- Design renderer (how timeline renders in present mode)
- Resolve name collision: `AnimationTimeline` (React component) vs `Timeline` (slide element)
- Design properties panel for timeline configuration
- Estimate integration points with existing code
- Create detailed phase plan at `plans/XXXXXXXX-timeline-element-implementation/`

### 2. Plugin Architecture + Manim (42-66h)
**Upstream commits:** `e37311be` + 9 commits
**Risk:** Trust boundary change, storage rewrite, sandbox, export hooks

**Planning tasks:**
- Read all 10 upstream commits to understand plugin system
- Design trust boundary model for self-hosted context (no Clerk auth)
- Design plugin storage (file-based vs database)
- Design sandbox for plugin execution
- Design export hooks integration
- Plan Manim integration specifically
- Security threat modeling for plugin execution
- Create detailed phase plan at `plans/XXXXXXXX-plugin-architecture-epic/`

### 3. Image Citation Controls (8-12h)
**Upstream commits:** `0e7196b6` + 3 commits
**Risk:** Schema extension for `ImageElement`

**Planning tasks:**
- Read all 4 upstream commits to understand citation feature
- Design schema extension: `citationText`, `citationLink` fields on `ImageElement`
- Design UI: where citation controls appear in properties panel
- Design present mode rendering: how citations display on images
- Create detailed phase plan at `plans/XXXXXXXX-image-citation-controls/`

## Todo List

- [ ] Read all Timeline element upstream commits
- [ ] Create Timeline element implementation plan
- [ ] Read all Plugin architecture upstream commits
- [ ] Create Plugin architecture implementation plan
- [ ] Read all Image citation upstream commits
- [ ] Create Image citation implementation plan
- [ ] Update development roadmap with deferred items

## Success Criteria

- 3 detailed implementation plans created in `plans/` directory
- Each plan has phases, file lists, risk assessment, and acceptance criteria
- Development roadmap updated with deferred items as future phases

## Notes

These deferred items require separate brainstorm → plan → implement cycles. They should NOT be attempted without proper planning due to their complexity and risk.
