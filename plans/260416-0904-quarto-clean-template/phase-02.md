# Phase 02: Template Fix — presenterTools + Correct Colors

## Overview

- **Priority:** High
- **Status:** pending
- **File to edit:** `server/data/built-in-templates.json`

## Context

`quarto-clean` template already exists at lines 23475–24082 in `built-in-templates.json`.
Current issues:
1. **Missing `presenterTools`** — needs `themeToggle`, `fontZoom`, `slideMenu`, `chalkboard`
2. **Wrong accent color** — current `#2a76dd`, should be `#2980b9`
3. **Title slide background** — current `#ffffff`, should be `#1a1a2e` (dark)
4. **Color scheme mismatch** — `accent` and `primary` need updating to match spec

## Spec Reference (from task)

| Property | Current | Correct |
|----------|---------|---------|
| accent | `#e64173` | `#2980b9` |
| primary | `#2a76dd` | `#2980b9` |
| title bg | `#ffffff` | `#1a1a2e` |
| title text | `#1a1a2e` | white/light |
| content bg | (white) | `#f5f5f5` |
| presenterTools | missing | all 4 enabled |

## Changes Required

### Step 1 — Add `presenterTools` to template root

Insert after `"transition": "slide"` (line 23501):

```json
    "presenterTools": {
      "themeToggle": true,
      "fontZoom": true,
      "slideMenu": true,
      "chalkboard": true
    }
```

### Step 2 — Fix colorScheme

```json
    "colorScheme": {
      "primary": "#2980b9",
      "background": "#ffffff",
      "text": "#404040",
      "accent": "#2980b9"
    }
```

### Step 3 — Fix title slide (qc-s1) background

Line 23556–23559 — change background color:

```json
        "background": {
          "type": "color",
          "color": "#1a1a2e"
        }
```

Also update title text element (line 23526) from dark `color:#1a1a2e` to white:

```json
"content": "<h1 style=\"text-align:left; color:#ffffff; font-family:serif; font-weight:700; font-size:42px\">A Minimalist and Elegant Presentation Theme</h1>"
```

Update author block text color (line 23535) from `#2a76dd` to `#2980b9`:

```json
"content": "<p style=\"color:#2980b9; font-size:18px; margin-bottom:4px\"><strong>Author Name</strong></p><p style=\"color:#b0b0b0; font-size:15px\">author@university.edu<br>University Name</p>"
```

Update co-author block (line 23544) similarly, and conference/date text from `#808080` to `#b0b0b0`.

### Step 4 — Fix accent bar on all slides

Every `qc-s*` slide has a top accent bar with `fill: "#2a76dd"` — update all to `#2980b9`.

### Step 5 — Fix content slide backgrounds to #f5f5f5

Slides qc-s2 through qc-s7 have `"color": "#ffffff"` — change to `"#f5f5f5"`.

## Todo List

- [ ] Add `presenterTools` object to template
- [ ] Update `colorScheme` accent/primary to `#2980b9`
- [ ] Change qc-s1 background to `#1a1a2e`
- [ ] Change qc-s1 title text to white
- [ ] Change qc-s1 author/coauthor text colors
- [ ] Change qc-s2–qc-s7 backgrounds to `#f5f5f5`
- [ ] Replace all `#2a76dd` fill strokes to `#2980b9`
- [ ] Validate JSON is valid (no trailing commas)

## Validation

```bash
# Validate JSON syntax
powershell -Command "Get-Content 'server/data/built-in-templates.json' | ConvertFrom-Json | Out-Null; Write-Host 'Valid JSON'"
```

## Related Code Files

| File | Action |
|------|--------|
| `server/data/built-in-templates.json` | Edit — patch existing `quarto-clean` object |
| `shared/src/presenterTools.js` | Read only — reference for available presenterTools keys |

## Next Steps

Phase 01 (Playwright tests) can run in parallel — no dependency on Phase 02.

Phase 03 (browser verification) must wait for Phase 02 — needs updated template to load.
