---
phase: 7
title: "P2-P3 Fixture Migration + Architecture Cleanup (split by concern, not tab)"
status: completed
priority: P2
effort: "6h"
dependencies: [1, 3]
---

# Phase 7: P2-P3 Fixture Migration + Architecture Cleanup

## Overview

Three structural cleanups:
1. **Fixture migration:** Replace ad-hoc `page.evaluate(() => fetch('/api/presentations', ...))` / inline `request.post` patterns with the `testPresentation` fixture
2. **Page-object rename:** kebab-case for filenames (`EditorPage.js` → `editor-page.js`) to match project convention
3. **Split `tests/e2e/ribbon-layout.spec.js`** (623 LOC, target ≤200) into per-concern files — NOT per-tab (the existing file is organised by 9 concerns: clipping, overflow matrix, vertical rhythm, etc., NOT by 7 tabs)

**Critical correction (post red-team H7):** Original plan split into 7 per-tab files including a nonexistent `file-tab.spec.js`. Real ribbon tabs are `home, insert, design, format, transitions, animations, view` (NO `file` — file is a dropdown menu). And the source file's 9 `test.describe` blocks are concern-aligned, not tab-aligned — splitting blindly by tab scatters related tests.

**Dependency change:** Phase 7 now `[1, 3]` (was `[2, 3]`). Phase 2 is not a blocker — fixture migration only needs Phase 1's fixture additions + Phase 3's testids.

## Requirements

- [x] Zero ad-hoc presentation creation in `tests/e2e/**` — only `testPresentation` fixture
- [x] All page-object files kebab-case
- [x] No spec file >200 LOC
- [x] Imports updated everywhere
- [x] Ribbon split by CONCERN (8 nested concern describes → 8 spec files, NOT 7 tabs)
- [x] Nightly workflow `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml:31` updated to `tests/e2e/ribbon/` with `--grep "768px"`

## Completion Evidence

- Added audit tests: `page-object-kebab-case`, `ribbon-split-completeness`, `nightly-workflow-ribbon-ref-updated`, `no-adhoc-presentation-creation`, `spec-file-size`.
- Migrated remaining root presentation creation in PPTX/regression specs to `testPresentation` + update helpers.
- Renamed page objects to kebab-case and fixed stale imports, including `game-page.js`.
- Deleted `tests/e2e/ribbon-layout.spec.js`; `npx playwright test tests/e2e/ribbon --list` reports **73 tests in 8 files**.
- Split all remaining oversized e2e specs so `spec-file-size.test.js` enforces every `tests/e2e/**/*.spec.js` at ≤200 LOC.
- Validation passed: audit unit tests **14 passed**, affected Playwright group **182 passed**, `npm run lint` **0 errors / 109 existing warnings**, `npm run build` passed.

## Architecture

### Fixture Migration
`testPresentation` fixture in `tests/e2e/fixtures/test-fixtures.js:123-133` provides:
- Auto-create on test entry
- Auto-cleanup on test exit
- Returns `{ id, title, shareToken, slides: [...] }`

### Page-Object Rename
Current: `EditorPage.js`, `RibbonInsertHelper.js`, `RibbonToolbarHelper.js` (PascalCase)
Target: `editor-page.js`, `ribbon-insert-helper.js`, `ribbon-toolbar-helper.js`
Convention from `CLAUDE.md`: kebab-case for file names.

**Windows FS hazard:** PascalCase → kebab rename is case-only on Windows NTFS (case-insensitive); a one-step `git mv` won't actually update the index. Use the documented two-step pattern: `git mv EditorPage.js editor-page-tmp.js && git mv editor-page-tmp.js editor-page.js`. Verify with `git ls-files | grep editor-page` post-rename.

### Ribbon Split — By Concern (NOT By Tab)
Source: `tests/e2e/ribbon-layout.spec.js:1-623`. Verified structure: ONE top-level `test.describe('Ribbon Layout Baseline Tests')` containing 8 nested `test.describe` blocks (9 total `describe` calls in file).

Verified line markers via `grep -n "test\.describe" tests/e2e/ribbon-layout.spec.js`:
- L144 — top-level "Ribbon Layout Baseline Tests"
- L161 — "Icon+Text Button Clipping"
- L179 — "Insert Tab Critical Controls Visibility"
- L319 — "Classic Ribbon Group Contract"
- L344 — "Home Tab Text-Editing State"
- L391 — "Format Tab Vertical Rhythm"
- L466 — "All Tabs Overflow Matrix"
- L529 — "Responsive Pressure Points"
- L556 — "Header Responsive Pressure"

Split target (8 concern-aligned files; the top-level describe becomes implicit wrapping in each file):
- `ribbon/icon-text-button-clipping.spec.js`
- `ribbon/insert-tab-critical-controls-visibility.spec.js`
- `ribbon/classic-ribbon-group-contract.spec.js`
- `ribbon/home-tab-text-editing-state.spec.js`
- `ribbon/format-tab-vertical-rhythm.spec.js`
- `ribbon/all-tabs-overflow-matrix.spec.js`
- `ribbon/responsive-pressure-points.spec.js`
- `ribbon/header-responsive-pressure.spec.js`

(Mapping: 8 nested describes = 8 spec files. Top-level wrapper context is replicated as module-level `beforeEach` per file if needed.)

If any resulting file still >200 LOC, further split by sub-feature (e.g. overflow-matrix → one file per ribbon tab matrix row).

## Related Code Files

**Modify (existing specs — migrate to fixture):**
- Grep `tests/e2e/**/*.spec.js` for `fetch.*\/api\/presentations` or `request.post.*\/api\/presentations` → replace with `testPresentation` fixture parameter
- Anchor regex precisely (per red-team M14): exclude `/share`, `/snapshot` sub-paths

**Rename (kebab-case via two-step git mv on Windows):**
- `tests/e2e/pages/EditorPage.js` → `tests/e2e/pages/editor-page.js`
- `tests/e2e/pages/RibbonInsertHelper.js` → `tests/e2e/pages/ribbon-insert-helper.js`
- `tests/e2e/pages/RibbonToolbarHelper.js` → `tests/e2e/pages/ribbon-toolbar-helper.js`
- Any other PascalCase under `tests/e2e/pages/` (audit via unit test below)

**Split:**
- `tests/e2e/ribbon-layout.spec.js` → 8 concern-aligned files under `tests/e2e/ribbon/`

**Update imports:**
- Every spec / helper that imports the renamed files

**Update CI workflow (SAME commit as the split):**
- `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml:31` — currently `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium --reporter=line --grep "768px"`. The `--grep "768px"` filter likely matches the `all-tabs-overflow-matrix` describe (and possibly `responsive-pressure-points`). Replace with one of:
  - `npx playwright test tests/e2e/ribbon/ --project=chromium --reporter=line --grep "768px"` (preserves the grep, scopes to new split directory)
  - Or explicitly: `npx playwright test tests/e2e/ribbon/all-tabs-overflow-matrix.spec.js tests/e2e/ribbon/responsive-pressure-points.spec.js` (drops grep, lists the relevant files)

## Implementation Steps

### Red — Fixture Audit

1. Write `tests/unit/no-adhoc-presentation-creation.test.js`:
   ```js
   import { describe, it, expect } from 'vitest';
   import { execSync } from 'node:child_process';

   describe('no ad-hoc presentation creation in e2e', () => {
     it('zero fetch/request to /api/presentations (root path only) outside fixtures', () => {
       // Anchor precisely — exclude /share, /snapshot, etc. (per red-team M14)
       const out = execSync(
         `git grep -l -E "(fetch|request\\.post)\\(\\s*['"\\\`]\\s*\\$?\\{?[\\w\\.]*?\\}?/?api/presentations['"\\\`]?\\s*," tests/e2e/ ` +
         '| grep -v "fixtures/" || true',
         { encoding: 'utf8', shell: '/bin/bash' }
       );
       expect(out.trim()).toBe('');
     });
   });
   ```
2. Run → expect failures (current ad-hoc patterns)

### Green — Fixture Migration

3. For each spec found in step 1:
   - Replace inline create with `testPresentation` fixture parameter
   - Drop manual cleanup
   - Re-run that spec → green

### Red — Filename Audit

4. Write `tests/unit/page-object-kebab-case.test.js`:
   ```js
   import { describe, it, expect } from 'vitest';
   import { readdirSync } from 'node:fs';

   describe('page-object filename convention', () => {
     it('all files in tests/e2e/pages/ are kebab-case', () => {
       const files = readdirSync('tests/e2e/pages').filter(f => f.endsWith('.js'));
       const violations = files.filter(f => /[A-Z]/.test(f));
       expect(violations).toEqual([]);
     });
   });
   ```
5. Run → expect failure

### Green — Rename (two-step for case-insensitive FS)

6. `git mv tests/e2e/pages/EditorPage.js tests/e2e/pages/editor-page-tmp.js && git mv tests/e2e/pages/editor-page-tmp.js tests/e2e/pages/editor-page.js`
7. `git mv tests/e2e/pages/RibbonInsertHelper.js tests/e2e/pages/ribbon-insert-helper-tmp.js && git mv tests/e2e/pages/ribbon-insert-helper-tmp.js tests/e2e/pages/ribbon-insert-helper.js`
8. `git mv tests/e2e/pages/RibbonToolbarHelper.js tests/e2e/pages/ribbon-toolbar-helper-tmp.js && git mv tests/e2e/pages/ribbon-toolbar-helper-tmp.js tests/e2e/pages/ribbon-toolbar-helper.js`
9. Verify: `git ls-files tests/e2e/pages/ | grep -i editor-page` shows lowercase
10. `git grep -l "from.*pages/EditorPage" tests/` — update each import
11. `git grep -l "from.*pages/RibbonInsertHelper" tests/` — update each import
12. `git grep -l "from.*pages/RibbonToolbarHelper" tests/` — update each import
13. Run `npm run lint` → catch any missed updates
14. Run unit test → green

### Red — Ribbon Split (per concern, not per tab)

15. Write `tests/unit/spec-file-size.test.js`:
    ```js
    import { describe, it, expect } from 'vitest';
    import { readdirSync, readFileSync } from 'node:fs';
    import { join } from 'node:path';

    function walk(dir) {
      return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
        d.isDirectory() ? walk(join(dir, d.name)) :
        d.name.endsWith('.spec.js') ? [join(dir, d.name)] : []
      );
    }

    describe('no oversized spec files', () => {
      it('every .spec.js under tests/e2e ≤200 LOC', () => {
        const oversized = walk('tests/e2e').filter(f => {
          const lines = readFileSync(f, 'utf8').split('\n').length;
          return lines > 200;
        });
        expect(oversized).toEqual([]);
      });
    });
    ```
16. Run → expect `tests/e2e/ribbon-layout.spec.js` (623 LOC) in failure list

### Green — Split

17. Read `tests/e2e/ribbon-layout.spec.js` at the verified line markers (L161, 179, 319, 344, 391, 466, 529, 556)
18. For each of the 8 nested describes, create the corresponding `tests/e2e/ribbon/{concern-slug}.spec.js` with:
    - The relevant `test.describe` block (un-nested — promote to top-level)
    - Imports (`test, expect` from fixtures; `testPresentation` if used)
    - Any module-level constants from `ribbon-layout.spec.js:1-143` (the preamble)
    - Any shared `beforeEach` from the original top-level wrapper
19. Verify total test count unchanged: `npx playwright test tests/e2e/ribbon --list | wc -l` vs `npx playwright test tests/e2e/ribbon-layout.spec.js --list | wc -l` (run BEFORE deletion of original)
20. Delete `tests/e2e/ribbon-layout.spec.js`
21. Update `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml:31` IN THE SAME COMMIT — change spec target to `tests/e2e/ribbon/` (preserves grep filter)
22. Re-run unit test → green
23. Run `npm run test:e2e -- tests/e2e/ribbon/` → all green

### Refactor

24. If any of the 8 new files still exceed 200 LOC, further split by sub-feature
25. Centralize ribbon-related helpers in `tests/e2e/pages/ribbon-helpers.js` if duplication emerges across split files

## Success Criteria

- [x] `no-adhoc-presentation-creation.test.js` passes
- [x] `page-object-kebab-case.test.js` passes
- [x] `spec-file-size.test.js` passes (all ≤200 LOC)
- [x] Affected Phase 7 E2E group passed (182/182)
- [x] Git index records the page-object renames
- [x] `tests/e2e/ribbon-layout.spec.js` deleted
- [x] `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml:31` updated to split path
- [x] 8 concern-aligned spec files under `tests/e2e/ribbon/` (NOT 7 tab-aligned)

## Tests (verification)

All four audit specs above. Plus:

```js
// tests/unit/ribbon-split-completeness.test.js
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('ribbon-layout split (by concern, not by tab)', () => {
  const expected = [
    'icon-text-button-clipping',
    'insert-tab-critical-controls-visibility',
    'classic-ribbon-group-contract',
    'home-tab-text-editing-state',
    'format-tab-vertical-rhythm',
    'all-tabs-overflow-matrix',
    'responsive-pressure-points',
    'header-responsive-pressure',
  ];

  for (const slug of expected) {
    it(`tests/e2e/ribbon/${slug}.spec.js exists`, () => {
      expect(existsSync(`tests/e2e/ribbon/${slug}.spec.js`)).toBe(true);
    });
  }

  it('old ribbon-layout.spec.js removed', () => {
    expect(existsSync('tests/e2e/ribbon-layout.spec.js')).toBe(false);
  });

  it('no invented file-tab.spec.js (file is a dropdown menu, not a tab)', () => {
    expect(existsSync('tests/e2e/ribbon/file-tab.spec.js')).toBe(false);
  });
});

// tests/unit/nightly-workflow-ribbon-ref-updated.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('nightly ribbon-layout workflow uses split path', () => {
  const wf = readFileSync(
    '.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml',
    'utf8'
  );

  it('targets the split directory, not the deleted monolithic spec', () => {
    expect(wf).not.toMatch(/tests\/e2e\/ribbon-layout\.spec\.js/);
    expect(wf).toMatch(/tests\/e2e\/ribbon\//);
  });
});
```

## Risk Assessment

- **Risk (RESOLVED post-audit H7):** Original plan invented `file-tab.spec.js` for a non-existent ribbon tab. Mitigation: split now by 8 concerns (verified via `grep -n "test\\.describe"`) not 7 tabs. `ribbon-split-completeness.test.js` asserts no `file-tab.spec.js` exists.
- **Risk (RESOLVED post-audit):** Phase 7 dependency on Phase 2 was incorrect (no file overlap). Mitigation: dependency changed to `[1, 3]`.
- **Risk:** PascalCase imports cached by Node's case-insensitive Windows FS. Mitigation: two-step rename pattern (PascalCase → tmp → kebab). Verify with `git ls-files`.
- **Risk:** Import path renames miss a file → runtime ReferenceError on next spec run. Mitigation: `npm run lint` after rename + dry-run `npx playwright test --list` before commit.
- **Risk:** Splitting ribbon spec loses shared `beforeEach` from top-level wrapper. Mitigation: copy preamble (L1-143) constants + helper functions to each split file; refactor to shared `tests/e2e/pages/ribbon-helpers.js` if duplication emerges.
- **Risk:** Fixture migration changes test isolation semantics (auto-cleanup may break parallel tests sharing same presentation). Mitigation: fixture creates unique presentation per test by default — verified in fixture source.
- **Risk:** Nightly 768px workflow not updated in same commit → CI breaks. Mitigation: `nightly-workflow-ribbon-ref-updated.test.js` asserts the workflow YAML references the new split path; gates the PR.
- **Risk:** Ribbon split rebalances CI shards. Mitigation: Phase 8 profiles shard balance via `--reporter=list` timings.

## Next Steps

- Phase 8 verifies final shard balance + total wallclock vs Phase 1 baseline
