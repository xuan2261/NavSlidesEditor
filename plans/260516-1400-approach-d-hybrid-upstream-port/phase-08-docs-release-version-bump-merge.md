# Phase 8: Docs & Release

**Priority:** P1
**Status:** pending
**Effort:** 2h

---

## Context Links

- [Overview Plan](hybrid-upstream-port-overview-plan.md)
- [Project Changelog](../../docs/project-changelog.md)
- [Development Roadmap](../../docs/development-roadmap.md)

## Overview

Update documentation, bump version, and create merge commit for the ported features.

## Implementation Steps

### Step 1: Update project changelog
Add entries to `docs/project-changelog.md` for each ported feature:

- **Present Mode CSS Fixes**: 11 upstream CSS commits ported — fixes text spacing, auto-animate leaks, cross-slide image bleed, fragment visibility, overview mode, reveal.js theme overrides
- **Fragment Animations**: Added strike, slide-up/down/left/right, flip-up/down, semi-fade-out, highlight-current-* animation types
- **Canvas Fixes**: Fixed cropped images in editor, wrapped iframes for animation compatibility
- **Video from URL**: Added option to add video by URL without uploading
- **Line-arrow shape**: Added line-arrow shape type (if applicable)
- **File browser**: Added file browser panel in editor (if applicable)
- **SHA-256 upload dedup**: Added hash-based upload deduplication
- **LaTeX direct render**: Non-TikZ LaTeX now renders directly with KaTeX in present mode

### Step 2: Update development roadmap
Update `docs/development-roadmap.md`:
- Mark upstream port phase as complete
- Add deferred items (Timeline, Plugin, Citation) as future phases

### Step 3: Version bump
Update version in `package.json` following semver:
- If current is 1.7.1 → bump to 1.8.0 (new features)

### Step 4: Create merge commit
```bash
git add -A
git commit -m "feat(upstream): port upstream v2 present mode CSS fixes, fragment animations, and editor features

Port 19 upstream commits from parallax-presentations:
- Present mode CSS fixes (11 commits): text spacing, auto-animate, fragment visibility
- Fragment animations: strike, slide, flip, semi-fade-out, highlight-current
- Canvas fixes: cropped images, iframe animation wrapping
- Editor features: video from URL, file browser, line-arrow shape
- Server: SHA-256 upload deduplication
- LaTeX: direct KaTeX render in present mode

Deferred: Timeline element, Plugin architecture, Image citation
See plans/260516-1400-approach-d-hybrid-upstream-port/ for details"
```

### Step 5: Push and create PR (if requested)
- Push branch to origin
- Create PR with summary

## Todo List

- [ ] Update `docs/project-changelog.md`
- [ ] Update `docs/development-roadmap.md`
- [ ] Bump version in `package.json`
- [ ] Create merge commit
- [ ] Push to origin (if requested)
- [ ] Create PR (if requested)

## Success Criteria

- Changelog documents all ported features
- Roadmap reflects current state
- Version bumped appropriately
- Clean merge commit with descriptive message
