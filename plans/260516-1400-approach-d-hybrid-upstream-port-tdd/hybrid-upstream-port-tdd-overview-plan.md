# Approach D: Hybrid Upstream Port — TDD Plan

**Date:** 2026-05-17
**Status:** pending
**Method:** Test-Driven Development — write tests FIRST, then implement
**Brainstorm:** [upstream-v2-port-audit-and-brainstorm-report.md](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md)
**Predict:** [5-expert-personas-predict-report.md](predict-report-5-expert-personas-debate.md)
**Upstream:** `https://github.com/jbirky/parallax-presentations` (142 commits)

---

## Overview

Port 19 low/medium-risk upstream commits into NavSlidesEditor using TDD approach. Each phase: write tests first → implement → verify tests pass. Defer Timeline, Plugin, Citation to separate plans.

## Key Decisions from 5-Expert Predict

1. **CSS golden-file snapshot test mandatory** — before and after Phase 2
2. **Do NOT port `window.prompt()` video URL** — use properties panel URL input instead
3. **Batch 11 CSS commits into 1 atomic change** — single commit, single review
4. **Audit `--font-zoom` impact** — changing 16px→42px affects 14 usages in element-renderers.js
5. **Dependency audit before port** — check deferred items have hidden deps on low/medium changes
6. **Align client/shared renderers** — iframe wrapping must match between both paths

## Phases

| # | Phase | Focus | Tests First | Effort | Status |
|---|-------|-------|-------------|--------|--------|
| 1 | [Safety Baseline + Dependency Audit](phase-01-safety-baseline-and-dependency-audit.md) | Backup, baseline tests, dependency map | Verify existing tests pass | 2h | pending |
| 2 | [CSS Snapshot Test + Present Mode Fixes](phase-02-css-snapshot-test-and-present-mode-fixes.md) | Golden-file test → 11 CSS commits | `html-generator-css.test.js` | 10-14h | pending |
| 3 | [Fragment Animations + Animation Dropdown](phase-03-fragment-animations-and-dropdown-ui.md) | New animation types + grouped dropdown | `fragment-animations.test.js` | 6-8h | pending |
| 4 | [Canvas Image Crop + Iframe Wrapping](phase-04-canvas-image-crop-and-iframe-wrapping.md) | Nested wrapper divs, container divs | `element-renderers.test.js` | 6-8h | pending |
| 5 | [Video URL + File Browser](phase-05-video-url-and-file-browser.md) | Properties panel URL input, media library | `video-url.test.js`, e2e | 8-10h | pending |
| 6 | [SHA-256 Upload Deduplication](phase-06-sha256-upload-deduplication.md) | Hash-based dedup for flat-file storage | `upload-dedup.test.js` | 3-4h | pending |
| 7 | [LaTeX Direct KaTeX Render](phase-07-latex-direct-katex-render.md) | Non-TikZ direct render, sandbox audit | `latex-render.test.js`, security tests | 4-5h | pending |
| 8 | [Regression Sweep](phase-08-regression-sweep-full-test-suite.md) | Full test suite + manual verification | All tests | 4h | pending |
| 9 | [Docs & Release](phase-09-docs-release-and-version-bump.md) | Changelog, version, merge | — | 2h | pending |
| 10 | [Deferred High-Risk Plans](phase-10-deferred-high-risk-planning.md) | Timeline, Plugin, Citation plans | — | 3-4h | pending |

**Total estimated effort:** 48-63h

## Dependencies

```
Phase 1 (baseline) → Phase 2 (CSS) → Phase 3 (animations) → Phase 4 (canvas/iframe)
                                                              → Phase 5 (video/browser)
                                                              → Phase 6 (dedup)
                                                              → Phase 7 (LaTeX)
                                         ↓
                                    Phase 8 (regression) → Phase 9 (docs) → Phase 10 (deferred)
```

## Architecture Mapping

| Upstream File | Local Equivalent | Notes |
|--------------|-----------------|-------|
| `client/src/utils/generateHTML.js` | `shared/src/htmlGenerator.js` | Single source (not duplicated) |
| `server/index.js` (CSS) | `shared/src/htmlGenerator.js` | Server imports from shared |
| `client/src/components/SlideCanvas.jsx` | `client/src/components/canvas/canvas-element-wrapper.jsx` | Decomposed |
| `client/src/components/AnimationTimeline.jsx` | `client/src/components/AnimationTimeline.jsx` | Same path |
| `client/src/components/PropertiesPanel.jsx` | `client/src/components/properties/*.jsx` | 12 decomposed files |
| `client/src/components/Toolbar.jsx` | `client/src/components/Toolbar.jsx` | Same path |
| `client/src/utils/shapeUtils.js` | `shared/src/shapeUtils.js` | Moved to shared |
| `server/services/upload-service.js` | `server/routes/upload.js` | Different structure |
