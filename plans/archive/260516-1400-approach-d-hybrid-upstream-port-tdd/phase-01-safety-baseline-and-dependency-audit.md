# Phase 1: Safety Baseline + Dependency Audit

**Priority:** P0
**Status:** pending
**Effort:** 2h

---

## Context Links

- [Overview Plan](hybrid-upstream-port-tdd-overview-plan.md)
- [Predict Report](predict-report-5-expert-personas-debate.md)

## Overview

Create backup branch, establish test baseline, and audit dependencies between low/medium commits and deferred high-risk items. This is the foundation — no code changes.

## TDD Approach

No tests to write yet — this phase VERIFIES existing tests pass and CREATES the baseline for comparison.

## Implementation Steps

### Step 1: Fetch and backup
```bash
git fetch upstream
git checkout -b backup/pre-upstream-v2-port-tdd-260517
git push origin backup/pre-upstream-v2-port-tdd-260517
```

### Step 2: Create worktree
```bash
git worktree add ../NavSlidesEditor-port-v2-tdd -b sync/upstream-v2-port-tdd-260517 master
```

### Step 3: Baseline test results (in worktree)
```bash
cd ../NavSlidesEditor-port-v2-tdd
npm run lint 2>&1 | tee /tmp/baseline-lint.txt
npm run test 2>&1 | tee /tmp/baseline-test.txt
npm run build 2>&1 | tee /tmp/baseline-build.txt
npm run test:corpus 2>&1 | tee /tmp/baseline-corpus.txt
```

### Step 4: Record baseline metrics
- Lint: pass/fail + warning count
- Unit tests: pass/fail/skip count
- Build: success/fail
- Corpus: fidelity percentage

### Step 5: Dependency audit (per Persona 5 recommendation)
Check if deferred items have hidden dependencies on low/medium commits:

1. **Timeline → CSS**: Do any CSS commits assume timeline-specific fragment classes?
   - Read `client/src/components/canvas/element-renderers/timeline-element-renderer.jsx`
   - Check if it uses fragment classes that CSS commits would modify

2. **Timeline → iframe wrapping**: Does timeline rendering use iframes?
   - Check if timeline renderer outputs `<iframe>` elements
   - If yes, Phase 4 iframe wrapping must account for it

3. **Plugin → CSS**: Does plugin system inject custom CSS?
   - Read `shared/src/presenterTools.js` for plugin CSS injection points
   - Check if CSS variable overrides conflict with plugin styles

4. **Citation → image crop**: Does citation positioning depend on image wrapper structure?
   - Read `element-renderers.js` for `buildCitationHtml()` function
   - Check if citation HTML is inside or outside the image wrapper div

5. **Font-zoom impact**: Map all 14 usages of `--font-zoom` in `element-renderers.js`
   - List each element type that uses `calc(${fontSize}px * var(--font-zoom, 1))`
   - Determine if changing base from 16px to 42px breaks any element

### Step 6: Document findings
Create `dependency-audit-findings.md` in the plan directory with:
- Dependency matrix (which deferred items depend on which low/medium commits)
- Font-zoom impact analysis
- Recommended port order adjustments (if any)

## Todo List

- [ ] Fetch upstream
- [ ] Create backup branch
- [ ] Push backup to origin
- [ ] Create worktree
- [ ] Run lint baseline
- [ ] Run unit tests baseline
- [ ] Run build baseline
- [ ] Run corpus test baseline
- [ ] Audit Timeline → CSS dependencies
- [ ] Audit Timeline → iframe wrapping dependencies
- [ ] Audit Plugin → CSS dependencies
- [ ] Audit Citation → image crop dependencies
- [ ] Map all `--font-zoom` usages
- [ ] Document findings in `dependency-audit-findings.md`

## Success Criteria

- Backup branch exists on origin
- Worktree created and verified
- All baseline tests pass (or failures documented)
- Dependency audit complete with findings documented
- Font-zoom impact analysis complete

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Tests fail on clean master | Document failures, fix before proceeding |
| Worktree conflicts with existing worktrees | Check `git worktree list`, clean stale ones |
| Dependency audit reveals blocking deps | Adjust port order or pull blocking pieces forward |
