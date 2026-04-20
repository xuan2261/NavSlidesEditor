# Plan: Quarto Clean Template + Slide Menu Tools Verification

**Created:** 2026-04-16
**Status:** Active

## Overview

| # | Phase | Status | Owner |
|---|-------|--------|-------|
| 01 | Browser Testing — Slide Menu Tools (Playwright) | pending | planner |
| 02 | Template Fix — Add presenterTools + correct colors | ✅ Complete | planner |
| 03 | Browser Verification — Manual template test | pending | planner |
| 04 | Finalize & Docs | pending | planner |

## Context

- **Quarto Clean template** already exists in `server/data/built-in-templates.json` (lines 23475–24082) with 8 slides but is **missing** `presenterTools` config and uses wrong colors.
- **Slide Menu Tools handlers** in `shared/src/presenterTools.js:95–102` — 6 handlers need browser verification.

## Key Files

| File | Action |
|------|--------|
| `server/data/built-in-templates.json` | Edit — add `presenterTools`, fix colors |
| `shared/src/presenterTools.js` | No changes — verify only |

## Deliverables

1. Playwright test report confirming all 6 Slide Menu Tools handlers work
2. Updated `quarto-clean` template with correct specs
3. Browser screenshot/video of template in editor

## Unresolved Questions

- Does Electron desktop app support same Playwright approach as browser dev server?

---

## Completed

### Phase 02 — Template Fix

- Added `presenterTools` config to `quarto-clean` template (themeToggle, fontZoom, slideMenu, chalkboard)
- Fixed accent color `#2a76dd` → `#2980b9` across all inline styles and shapes
- Fixed `colorScheme` accent → `#2980b9`
- qc-s1 (title): background `#ffffff` → `#1a1a2e` (dark), title text → white, author color → `#2980b9`, secondary → `#b0b0b0`
- qc-s2 through qc-s7: background `#ffffff` → `#f5f5f5` (light gray)
- qc-s8 (Thank You): kept white background
- All tests pass (6 files, 19 tests)
- Build passes
