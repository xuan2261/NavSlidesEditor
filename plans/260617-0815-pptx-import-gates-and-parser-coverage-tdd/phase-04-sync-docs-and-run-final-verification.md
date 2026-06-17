# Phase 04: Sync Docs And Run Final Verification

## Context Links

- README strict command text: `README.md:282-287`
- Code standards smoke/full audit text: `docs/code-standards.md:44-49`
- Roadmap threshold drift: `docs/project-roadmap.md:79-80,199-201`
- Fidelity report threshold drift and chart follow-up note: `docs/pptx-import-fidelity-report.md:103-110,351-390`
- System architecture stale placeholder claim: `docs/system-architecture.md:387-416`

## Overview

- Priority: `P1`
- Status: `pending`
- Goal: make docs tell the same story as the final code and gate contract, then run final smoke + release verification commands.

## Key Insights

- Docs currently disagree with each other even before comparing against code. Examples: roadmap still says strict round-trip `>=98%`, fidelity report says both `50%` and `99%`, README says `test:pptx:strict` runs full audit. Sources: `docs/project-roadmap.md:79-80,199-201`, `docs/pptx-import-fidelity-report.md:351-390`, `README.md:282-287`.
- System architecture also misstates current import behavior by claiming charts and SmartArt become locked placeholders, while runtime code already maps charts natively and flattens diagrams. Sources: `docs/system-architecture.md:387-392`, `server/services/pptx-import/chart-output-to-navslides-mapper.js:112-133`, `server/services/pptx-import/mapper/map-diagram.js:85-110`.
- A docs contract test is the cheapest anti-drift guard once the code contract is stable.

## Requirements

- Functional:
  1. Update user-facing docs so command semantics and thresholds match code.
  2. Add a docs contract test that locks the command names and stable threshold snippets.
  3. Run both smoke strict validation and full audit release validation.
- Non-functional:
  1. Keep the docs test tolerant to wording changes; only assert stable machine-readable snippets.
  2. Keep historical results in docs clearly labeled as historical evidence, not active gates.

## Architecture

- Data flow:
  1. Canonical gate values come from phase 1 shared exports.
  2. Canonical command semantics come from `package.json:50-54`.
  3. Docs contract test reads the doc files and package script text, then fails on drift.
- Verification matrix:
  - Unit: docs contract test
  - Integration: `npm run test:corpus`
  - E2E smoke gate: `npm run test:pptx:strict`
  - Release/full audit: `npm run test:pptx:browser-audit:full`

## Related Code Files

- Modify:
  - `README.md`
  - `docs/code-standards.md`
  - `docs/project-roadmap.md`
  - `docs/pptx-import-fidelity-report.md`
  - `docs/system-architecture.md`
- Create:
  - `tests/unit/pptx-import-docs-contract.test.js`
- Delete:
  - None.
- Exclusive ownership this phase:
  - Only the files above.

## Implementation Steps

1. Red:
   Add a docs contract test that reads `package.json` and the PPTX docs and asserts:
   - `test:pptx:strict` means corpus + smoke audit
   - the active strict gate percentages are consistent
   - docs do not describe chart/SmartArt behavior in a way that contradicts current code plus phase 3 reporting.
2. Implement:
   Update README, code standards, roadmap, fidelity report, and system architecture in one sweep after code is stable.
3. Verify:
   Run the docs contract test, then the full command ladder from targeted Vitest through full browser audit.
4. Record:
   If any full audit failures appear, do not relax smoke or corpus gates inside this phase; open follow-up work instead.

## Todo List

- [x] Add docs contract test.
- [x] Sync README and docs to final command/threshold contract.
- [x] Update stale system-architecture and roadmap wording.
- [x] Run smoke strict validation.
- [x] Run full browser audit as release validation.

## Success Criteria

- All listed docs agree on strict thresholds and command semantics.
- `npm run test:pptx:strict` is documented as corpus + smoke, not full.
- Final validation passes or fails loudly without hidden threshold/doc drift.

## Risk Assessment

- Medium, medium impact:
  - Docs tests can become brittle if they assert prose paragraphs.
  - Mitigation: assert stable command snippets and numeric thresholds only.
- High, medium impact:
  - Full browser audit is slow and may surface pre-existing deck/layout noise.
  - Mitigation: keep full audit in the last phase and treat failures as release blockers, not as reasons to silently weaken smoke strict semantics.

## Security Considerations

- Docs-only changes plus read-only test file access.
- No new runtime security surface.

## Rollback Plan

- Revert docs and docs-contract test together if wording is wrong while code remains correct.
- Do not roll back code thresholds or importer coverage logic from this phase.

## Next Steps

- Done when code, scripts, docs, and validation commands all agree.
- Remaining follow-up, if any, should be separate: CI workflow updates, broader audit corpus expansion, native SmartArt rendering.
