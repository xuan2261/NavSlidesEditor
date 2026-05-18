# Phase 8: Regression Sweep — Full Test Suite

**Priority:** P0
**Status:** pending
**Effort:** 4h

---

## Context Links

- [Overview Plan](hybrid-upstream-port-tdd-overview-plan.md)

## Overview

Run the complete test suite and manual verification to ensure no regressions from Phases 2-7. This is the quality gate before release.

## TDD Approach

This phase runs ALL tests — unit, integration, e2e, corpus. No new tests to write — verify existing + new tests all pass.

## Verification Steps

### Step 1: Lint
```bash
npm run lint
```
Fix any lint errors introduced by the port.

### Step 2: Unit tests
```bash
npm run test
```
Compare pass/fail count with Phase 1 baseline.

### Step 3: New TDD tests
```bash
npx vitest run shared/tests/html-generator-css.test.js
npx vitest run shared/tests/fragment-animations.test.js
npx vitest run shared/tests/element-renderers-structure.test.js
npx vitest run shared/tests/video-url.test.js
npx vitest run shared/tests/latex-render.test.js
npx vitest run server/tests/upload-dedup.test.js
```

### Step 4: Build
```bash
npm run build
```

### Step 5: E2E tests
```bash
npm run test:e2e
```

### Step 6: PPTX corpus
```bash
npm run test:corpus
```
Record fidelity. Must be ≥95%.

### Step 7: Manual present mode verification
Test 5 diverse presentations:
1. Simple text-only → verify spacing matches editor
2. Images (cropped + uncropped) → verify crop works
3. LaTeX (TikZ + non-TikZ) → verify both render
4. Fragments + animations → verify all 23 types work
5. Video + HTML embeds → verify iframes animate correctly

### Step 8: Manual PDF export
Export 3 presentations to PDF:
1. Text-heavy → verify spacing
2. Image-heavy → verify images render
3. LaTeX-heavy → verify math renders

### Step 9: Manual editor verification
1. Add each element type → verify renders
2. Crop image → verify only cropped region visible
3. Test all new fragment animation types
4. Add video by URL → verify playback
5. Upload same file twice → verify dedup

## Todo List

- [ ] `npm run lint` — pass
- [ ] `npm run test` — pass (compare with baseline)
- [ ] All new TDD tests pass
- [ ] `npm run build` — success
- [ ] `npm run test:e2e` — pass
- [ ] `npm run test:corpus` — ≥95%
- [ ] Manual present mode — 5 presentations
- [ ] Manual PDF export — 3 presentations
- [ ] Manual editor — all element types
- [ ] Document regressions found and fixed

## Success Criteria

- All lint checks pass
- All unit tests pass (no regression from baseline)
- All new TDD tests pass
- Build succeeds
- All E2E tests pass
- PPTX corpus fidelity ≥95%
- 5 presentations render correctly in present mode
- 3 presentations export correctly to PDF
- No regressions in editor functionality

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CSS changes break existing presentations | HIGH | Test diverse presentations, not just new ones |
| Fragment animation changes break existing animations | Medium | Test all 12 original + 11 new types |
| Iframe wrapping breaks existing HTML/chart elements | Medium | Test each iframe element type |
| Font-zoom system affected by 42px base | HIGH | Verify all 14 usages in element-renderers.js |
