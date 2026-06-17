# Phase 02: Make Strict Browser Gate Smoke-First

## Context Links

- Current scripts: `package.json:50-54`
- Browser audit launcher: `scripts/run-pptx-browser-audit.js:1-31`
- Smoke/full deck selector: `tests/e2e/pages/pptx-import-audit-helper.js:13-20`
- Strict audit assertion: `tests/e2e/pptx-import-real-browser-audit.spec.js:176-179`

## Overview

- Priority: `P1`
- Status: `pending`
- Goal: make `npm run test:pptx:strict` use the existing smoke subset by default, while keeping full audit explicit and unchanged.

## Key Insights

- The repo already has the split the user wants: smoke and full audit scripts exist, but `test:pptx:strict` still calls full. Source: `package.json:50-54`.
- The browser audit helper already supports smoke vs full via `PPTX_IMPORT_AUDIT_SCOPE`; no Playwright spec redesign is required. Source: `tests/e2e/pages/pptx-import-audit-helper.js:13-20`.
- The launcher has no direct unit test today; its top-level `spawnSync` code path should be refactored just enough to be testable without changing CLI behavior. Source: `scripts/run-pptx-browser-audit.js:1-31`.

## Requirements

- Functional:
  1. `npm run test:pptx:strict` must run `npm run test:corpus` followed by smoke browser audit, not full.
  2. `npm run test:pptx:browser-audit:full` and `npm run test:pptx:browser-audit:headed` stay callable exactly as today.
  3. Script tests must cover CLI arg parsing and env propagation.
- Non-functional:
  1. Preserve current Playwright project, worker, retry, and reporter defaults.
  2. Keep the audit helper smoke deck contract stable unless a later validation proves the subset invalid.

## Architecture

- Data flow:
  1. `npm run test:pptx:strict` invokes a package script in `package.json:50-54`.
  2. `scripts/run-pptx-browser-audit.js:3-29` translates flags into env vars.
  3. `tests/e2e/pptx-import-real-browser-audit.spec.js:132-179` reads those env vars and delegates deck selection to `tests/e2e/pages/pptx-import-audit-helper.js:13-20`.
- Minimal change set:
  - Keep the Playwright spec untouched.
  - Refactor the launcher into exported pure helpers or one callable function for unit tests.

## Related Code Files

- Modify:
  - `package.json`
  - `scripts/run-pptx-browser-audit.js`
  - `tests/unit/pptx-import-audit-helper.test.js`
- Create:
  - `scripts/run-pptx-browser-audit.test.js`
- Delete:
  - None.
- Exclusive ownership this phase:
  - Only the files above.

## Implementation Steps

1. Red:
   Add a launcher unit test proving `--strict --scope=smoke` becomes the exact Playwright invocation/env used by `npm run test:pptx:browser-audit`.
2. Red:
   Extend the helper test to lock smoke subset selection through `selectAuditDecks()`.
3. Implement:
   Refactor `scripts/run-pptx-browser-audit.js` into a testable function while preserving CLI entry behavior and exit-code propagation.
4. Implement:
   Change `package.json` so `test:pptx:strict` runs corpus plus smoke audit.
5. Verify:
   Run the new script/helper tests, then dry-run the smoke gate with `npm run test:pptx:strict`.

## Todo List

- [x] Add package script orchestration contract test.
- [x] Preserve existing smoke/full browser audit scope commands.
- [x] Switch `test:pptx:strict` to smoke.
- [x] Re-run smoke strict command through `npm run test:pptx:strict`.

## Success Criteria

- `npm run test:pptx:strict` no longer invokes `browser-audit:full`.
- `npm run test:pptx:browser-audit:full` still works unchanged.
- Unit tests lock env/arg behavior so the smoke/full split cannot silently regress.

## Risk Assessment

- High, medium impact:
  - Release users may have assumed `test:pptx:strict` means full.
  - Mitigation: leave full scripts untouched, document the new meaning clearly in phase 4, and call full audit explicitly in final validation.
- Medium, medium impact:
  - Refactoring the launcher can accidentally change exit-code semantics.
  - Mitigation: unit-test the spawned args/env and the final returned status path.

## Security Considerations

- No new network or file permissions.
- Preserve current `spawnSync` shell behavior on Windows.

## Rollback Plan

- Revert the package script and launcher refactor together.
- Keep the smoke/full helper tests if the repo still wants coverage for the launcher seam; otherwise revert as one commit.

## Next Steps

- Blocker to Phase 3: smoke strict command is green and the script contract is locked.
- Explicit release validation remains phase 4 through `npm run test:pptx:browser-audit:full`.
