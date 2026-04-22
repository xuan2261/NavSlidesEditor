# Phase 03: Browser Verification — Manual Template Test

## Overview

- **Priority:** Medium
- **Status:** pending
- **Type:** Manual browser testing

## Prerequisites

- Phase 02 must be complete (template JSON updated and server restarted)
- `npm run dev` running on `http://localhost:5173`

## Manual Test Checklist

### A. Load Template in Editor

1. Open `http://localhost:5173`
2. Click **New Presentation** or **Templates** button
3. Find and select **"Quarto Clean — Minimalist Academic"** (category: academic)
4. Verify:
   - [ ] Template loads with 8 slides
   - [ ] Slide 1 (title) has dark background `#1a1a2e`
   - [ ] White title text visible
   - [ ] Blue accent bar `#2980b9` at bottom of slide 1
5. Navigate to slides 2–7 (content slides)
   - [ ] Light background `#f5f5f5` visible
   - [ ] `#2980b9` accent bars at top
   - [ ] Typography uses serif/Palatino family

### B. Present Mode — Presenter Tools

1. Press **F** or click **Present** to enter reveal.js presentation mode
2. Open Slide Menu (hamburger icon or **M** key)
3. Click **Tools** tab
4. Verify all 6 tools visible with keyboard badges:
   - [ ] `f` Fullscreen
   - [ ] `s` Speaker View
   - [ ] `o` Slide Overview
   - [ ] `e` PDF Export Mode
   - [ ] `r` Scroll View Mode
   - [ ] `?` Keyboard Help
5. Test each tool:
   - [ ] **f** — browser enters fullscreen
   - [ ] **s** — new tab opens at `?receiver`
   - [ ] **o** — overview grid shown
   - [ ] **e** — new tab opens at `?print-pdf`
   - [ ] **r** — scroll view activates
   - [ ] **?** — help overlay shown

### C. Theme Toggle (if enabled)

1. In present mode, find theme toggle button (🌙 icon, top-right)
2. Click it
3. Verify:
   - [ ] Background changes from `#f5f5f5` to dark
   - [ ] Text color inverts
   - [ ] Toggle again returns to original theme

### D. Font Zoom (if enabled)

1. In present mode, find **A+** / **A−** buttons
2. Click **A+** multiple times
3. Verify:
   - [ ] Slide text size increases
   - [ ] **A−** decreases font size
   - [ ] Font size clamped between 50%–200%

### E. Chalkboard (if enabled)

1. In present mode, find pencil/notes toolbar
2. Click chalkboard icon
3. Verify:
   - [ ] Drawing canvas overlay appears
   - [ ] Can draw with mouse
   - [ ] Notes canvas toggle works

## Screenshots Required

| Shot | What to Capture                                  |
| ---- | ------------------------------------------------ |
| 1    | Template thumbnail in gallery                    |
| 2    | Slide 1 (title) in editor                        |
| 3    | Slides 2–7 (content) — 2–3 representative slides |
| 4    | Present mode with Tools menu open                |
| 5    | Each tool in action (overview, help, scroll)     |

Save to: `plans/260416-0904-quarto-clean-template/screenshots/`

## Success Criteria

- All 8 slides render correctly with specified colors
- All 4 presenter tool features (theme toggle, font zoom, slide menu, chalkboard) functional
- No console errors (F12 → Console tab) during presentation mode
- Template selectable from gallery and creates a fresh presentation

## Risks & Mitigation

| Risk                              | Mitigation                                                  |
| --------------------------------- | ----------------------------------------------------------- |
| Template not appearing in gallery | Restart server after JSON edit                              |
| Fonts not loading                 | Check network; Palatino is system font — fallback works     |
| Slide Menu not opening            | Verify `presenterTools.slideMenu: true` is in template JSON |
