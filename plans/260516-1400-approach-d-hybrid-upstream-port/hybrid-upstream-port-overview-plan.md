# Approach D: Hybrid Upstream Port — Low/Medium Now + Deferred High-Risk

**Date:** 2026-05-16
**Status:** pending
**Brainstorm:** [upstream-v2-port-audit-and-brainstorm-report.md](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md)
**Upstream:** `https://github.com/jbirky/parallax-presentations` (142 commits)

---

## Overview

Port all low/medium-risk upstream features/fixes into NavSlidesEditor. Defer Timeline, Plugin architecture, and Image citation to separate plans. All changes verified by fresh code-level audit.

## Phases

| # | Phase | Focus | Effort | Status |
|---|-------|-------|--------|--------|
| 1 | [Safety Baseline](phase-01-safety-baseline.md) | Backup branch, verify tests pass | 1h | pending |
| 2 | [Present Mode CSS Fixes](phase-02-css-present-mode-fixes.md) | 11 CSS commits → `htmlGenerator.js` | 8-12h | pending |
| 3 | [Canvas + Fragment Animations](phase-03-canvas-fragment-animations.md) | Image crop fix, iframe wrap, fragment types | 6-8h | pending |
| 4 | [Editor Features](phase-04-editor-features.md) | Line-arrow, video URL, file browser | 10-14h | pending |
| 5 | [Server Improvements](phase-05-server-improvements.md) | SHA-256 upload dedup | 3-4h | pending |
| 6 | [LaTeX Direct Render](phase-06-latex-direct-render.md) | KaTeX direct render (no iframe) | 3-4h | pending |
| 7 | [Regression Sweep](phase-07-regression-sweep.md) | Full test suite + manual verification | 4h | pending |
| 8 | [Docs & Release](phase-08-docs-release.md) | Changelog, version bump, merge | 2h | pending |
| 9 | [Deferred High-Risk](phase-09-deferred-high-risk.md) | Timeline, Plugin, Citation — separate plans | 3-4h (planning only) | pending |

**Total estimated effort:** 40-55h

## Key Dependencies

- Phase 2 must complete before Phase 3 (CSS foundation)
- Phase 3 must complete before Phase 6 (iframe wrapping affects LaTeX)
- Phases 4, 5, 6 are independent of each other
- Phase 7 runs after all implementation phases
- Phase 8 runs after Phase 7 passes

## Architecture Mapping

| Upstream File | Local Equivalent |
|--------------|-----------------|
| `client/src/utils/generateHTML.js` | `shared/src/htmlGenerator.js` |
| `server/index.js` (CSS sections) | `shared/src/htmlGenerator.js` |
| `client/src/components/SlideCanvas.jsx` | `client/src/components/canvas/canvas-element-wrapper.jsx` |
| `client/src/components/AnimationTimeline.jsx` | `client/src/components/AnimationTimeline.jsx` |
| `client/src/components/PropertiesPanel.jsx` | `client/src/components/properties/*.jsx` (decomposed) |
| `client/src/components/Toolbar.jsx` | `client/src/components/Toolbar.jsx` |
| `client/src/utils/shapeUtils.js` | `shared/src/shapeUtils.js` |
| `server/services/upload-service.js` | `server/routes/upload.js` |
