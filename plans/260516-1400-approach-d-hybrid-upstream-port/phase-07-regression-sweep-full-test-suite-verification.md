# Phase 7: Regression Sweep — Full Test Suite Verification

**Priority:** P0
**Status:** pending
**Effort:** 4h

---

## Context Links

- [Overview Plan](hybrid-upstream-port-overview-plan.md)

## Overview

Run the complete test suite and manual verification to ensure no regressions were introduced by Phases 2-6.

## Implementation Steps

### Step 1: Lint check
```bash
npm run lint
```
Fix any lint errors introduced by the port.

### Step 2: Unit tests
```bash
npm run test
```
Record pass/fail count. Compare with Phase 1 baseline.

### Step 3: Build verification
```bash
npm run build
```
Must succeed with no errors.

### Step 4: E2E tests
```bash
npm run test:e2e
```
Fix any Playwright failures.

### Step 5: PPTX corpus test
```bash
npm run test:corpus
```
Record fidelity percentage. Must be ≥95%.

### Step 6: Manual present mode verification
Test 5 diverse presentations in present mode:
1. Simple text-only presentation
2. Presentation with images (cropped and uncropped)
3. Presentation with LaTeX (TikZ and non-TikZ)
4. Presentation with fragments and animations
5. Presentation with video and HTML embeds

### Step 7: Manual PDF export verification
Export 3 presentations to PDF and verify:
1. Text spacing matches editor
2. Images render correctly
3. LaTeX renders correctly

### Step 8: Manual editor verification
1. Add each element type — verify renders correctly
2. Test crop on images
3. Test fragment animations (all new types)
4. Test video from URL
5. Test file browser (if implemented)

## Todo List

- [ ] `npm run lint` — pass
- [ ] `npm run test` — pass (compare with baseline)
- [ ] `npm run build` — success
- [ ] `npm run test:e2e` — pass
- [ ] `npm run test:corpus` — ≥95% fidelity
- [ ] Manual present mode — 5 presentations
- [ ] Manual PDF export — 3 presentations
- [ ] Manual editor — all element types
- [ ] Document any regressions found and fixed

## Success Criteria

- All lint checks pass
- All unit tests pass (no regression from baseline)
- Build succeeds
- All E2E tests pass
- PPTX corpus fidelity ≥95%
- 5 presentations render correctly in present mode
- 3 presentations export correctly to PDF
- No regressions in editor functionality

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CSS changes break existing presentations | Medium | Test diverse presentations, not just new ones |
| Fragment animation changes break existing animations | Low | Test all original animation types still work |
| Iframe wrapping breaks existing HTML/chart elements | Medium | Test each iframe element type |

## Verification Commands

```bash
npm run lint 2>&1 | tail -5
npm run test 2>&1 | tail -15
npm run build 2>&1 | tail -5
npm run test:e2e 2>&1 | tail -15
npm run test:corpus 2>&1 | tail -10
```
