---
phase: 7
title: "Verify all fixes — lint + test + smoke"
status: "completed"
priority: P0
effort: "30m"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Verify All Fixes — Lint + Test + Smoke

## Overview
Run lint, tests, and smoke verification after all fixes are applied. Verify no regressions.

## Requirements
- All lint errors resolved
- All unit tests pass
- App loads without errors
- Slide navigation works
- Element editing works

## Verification Steps

### Step 1: Lint
```bash
npm run lint 2>&1 | head -50
```
Expected: 0 errors (warnings OK)

### Step 2: Unit Tests
```bash
npx vitest run client/src/stores/presentation-store.test.js
npx vitest run client/src/stores/editor-store.test.js 2>/dev/null || echo "no editor-store tests"
npx vitest run client/src/hooks/ 2>/dev/null || echo "no hook tests"
npx vitest run 2>&1 | tail -20
```
Expected: 0 failures

### Step 3: Build Check
```bash
npm run build 2>&1 | tail -20
```
Expected: exit code 0

### Step 4: Manual Smoke (if dev server available)
1. `npm run dev` in background
2. Open http://localhost:5173
3. Create new presentation
4. Add 3 slides
5. Add text element to slide 2 (verify edit targets correct slide)
6. Insert slide after slide 1 (verify inserted at correct position)
7. Duplicate a slide
8. Open live presentation modal
9. Check browser console: no errors
10. Stop dev server

## Success Criteria
- [ ] Lint: 0 errors
- [ ] Unit tests: 0 failures
- [ ] Build: exit code 0
- [ ] Smoke: all interactions work correctly
- [ ] No console errors in browser

## Risk Assessment
- If lint errors → fix before proceeding
- If test failures → fix before proceeding
- If build fails → fix before proceeding
- If smoke fails → fix specific interaction

## Unresolved Questions
None — all issues addressed in phases 1-6.
