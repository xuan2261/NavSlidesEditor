# Phase 9: Docs & Release

**Priority:** P1
**Status:** pending
**Effort:** 2h

---

## Context Links

- [Overview Plan](hybrid-upstream-port-tdd-overview-plan.md)
- [Project Changelog](../../docs/project-changelog.md)
- [Development Roadmap](../../docs/development-roadmap.md)

## Overview

Update documentation, bump version, and create merge commit for all ported features.

## Implementation Steps

### Step 1: Update project changelog
Add entries to `docs/project-changelog.md`:

```markdown
## [1.8.0] - 2026-05-17

### Fixed
- Present mode text spacing now matches editor exactly (11 upstream CSS commits)
- Auto-animate slides no longer leak to non-auto-animate slides
- Cross-slide image bleed fixed with overflow:hidden
- Fragments now hidden until reveal.js triggers them
- Overview mode works correctly
- PDF export matches editor layout
- Cropped images show only cropped region in editor
- Iframes render correctly on animated slides

### Added
- 11 new fragment animation types: strike, slide-up/down/left/right, flip-up/down, semi-fade-out, highlight-current-*
- Video from URL option in properties panel (no upload needed)
- SHA-256 upload deduplication (prevents storing duplicate files)
- Grouped animation dropdown with category labels
- CSS variable overrides for reveal.js theme consistency

### Changed
- Animation dropdown reorganized into grouped categories (Fade, Scale, Slide, Flip, Highlight, Other)
- LaTeX present mode uses direct KaTeX render for non-TikZ content

### Deferred (separate plans)
- Timeline element (schema change, new renderer)
- Plugin architecture + Manim (trust boundary, storage rewrite)
- Image citation controls (schema extension)
```

### Step 2: Update development roadmap
In `docs/development-roadmap.md`:
- Mark upstream v2 port phase as complete
- Add deferred items as future phases with effort estimates

### Step 3: Version bump
In `package.json`: change version from `1.7.1` to `1.8.0` (new features = minor bump)

### Step 4: Create merge commit
```bash
git add -A
git commit -m "feat(upstream): port upstream v2 present mode CSS, fragment animations, and editor features

Port 19 upstream commits from parallax-presentations using TDD approach:
- Present mode CSS fixes (11 commits): text spacing, auto-animate, fragment visibility
- Fragment animations (1 commit): strike, slide, flip, semi-fade, highlight-current
- Canvas fixes (2 commits): cropped images, iframe animation wrapping
- Editor features (2 commits): video from URL, file browser evaluation
- Server (1 commit): SHA-256 upload deduplication
- LaTeX (1 commit): direct KaTeX render for non-TikZ in present mode

TDD: 6 new test files with snapshot, structural, and security tests.
Predict: 5-expert-personas debate identified and mitigated key risks.
Deferred: Timeline element, Plugin architecture, Image citation.

See plans/260516-1400-approach-d-hybrid-upstream-port-tdd/ for full details."
```

### Step 5: Push (if requested)
```bash
git push origin sync/upstream-v2-port-tdd-260517
```

## Todo List

- [ ] Update `docs/project-changelog.md`
- [ ] Update `docs/development-roadmap.md`
- [ ] Bump version in `package.json` to 1.8.0
- [ ] Create merge commit
- [ ] Push to origin (if requested)
- [ ] Create PR (if requested)

## Success Criteria

- Changelog documents all ported features
- Roadmap reflects current state with deferred items
- Version bumped to 1.8.0
- Clean merge commit with descriptive message
