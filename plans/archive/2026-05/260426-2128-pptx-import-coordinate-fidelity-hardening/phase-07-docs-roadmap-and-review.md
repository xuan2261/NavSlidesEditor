---
phase: 7
title: "Docs Roadmap And Review"
status: completed
priority: P2
effort: "1d"
dependencies: [5, 6]
---

# Phase 7: Docs Roadmap And Review

## Context Links
- `docs/pptx-import-fidelity-report.md`
- `docs/project-roadmap.md`
- `docs/project-changelog.md`
- `docs/codebase-summary.md`
- `docs/system-architecture.md`
- `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/plan.md`

## Overview
Close the hardening work with updated docs, final verification evidence, and
review handoff. This phase records what changed, what gates passed, and what
fidelity gaps remain.

## Key Insights
- Prior docs report "all pass" but also notes small corpus and no per-type hard
  gates. The new plan must update that truth after implementation.
- Docs should not claim perfect PPTX parity. State exact supported behavior and
  residual approximations.
- Final review should focus on correctness, tests, and regressions, not cosmetic
  lint churn.

## Requirements
- Functional: documentation reflects implemented geometry/property behavior.
- Functional: final verification commands and results are saved.
- Non-functional: concise reports; unresolved questions listed at end.

## Architecture
```text
implementation result
  -> final test/corpus/e2e gates
  -> docs updates
  -> review report
  -> cook handoff complete
```

## Related Code Files
- Modify: `docs/pptx-import-fidelity-report.md`
- Modify: `docs/project-roadmap.md`
- Modify: `docs/project-changelog.md`
- Modify: `docs/codebase-summary.md`
- Modify: `docs/system-architecture.md` if geometry/import architecture changes.
- Create: `plans/260426-2128-pptx-import-coordinate-fidelity-hardening/reports/final-verification.md`
- Create: `plans/reports/reviewer-260426-pptx-import-coordinate-fidelity.md`

## Tests Before
- No new app tests in this phase unless final review finds a missed regression.
- Prepare final command checklist and expected report fields before running:
  status, command, duration, pass/fail, failure owner.

## Implementation Steps
1. Update `docs/pptx-import-fidelity-report.md`:
   - new geometry normalizer.
   - crop model decision.
   - group/line transform behavior.
   - per-type gates and corpus result.
2. Update `docs/project-changelog.md` with a dated fixed entry.
3. Update `docs/project-roadmap.md` progress for PPTX import fidelity.
4. Update `docs/codebase-summary.md` and `docs/system-architecture.md` only if
   new modules or data flow changed.
5. Run final gates and write `reports/final-verification.md`.
6. Run code review after tests pass; record findings and follow-up items.
7. Keep the plan status pending until implementation session explicitly checks
   phases through `ck plan check`.

## Todo List
- [x] Update fidelity report.
- [x] Update roadmap/changelog.
- [x] Update architecture/codebase summary if needed.
- [x] Save final verification report.
- [x] Complete code review report.
- [x] List unresolved questions.

## Success Criteria
- [x] Docs match actual behavior and gates.
- [x] Final verification report includes every command result.
- [x] Code review has no unresolved P0/P1 correctness issues.
- [x] Remaining gaps are explicit and assigned.

## Risk Assessment
- Risk: docs overstate fidelity.
- Mitigation: document exact gates and corpus size.
- Risk: final gates are slow or flaky.
- Mitigation: separate deterministic unit/corpus failures from Playwright flake
  and rerun once with evidence.

## Security Considerations
- Do not include proprietary deck names/content in public docs.
- Changelog should mention behavior, not private fixture details.
- Reports must not include raw parser dumps.

## Final Verification Gate
```bash
npm run lint
npm run test -- server/services/pptx-import client/src/components/properties/import-fidelity-properties.test.jsx
npm run test:corpus
npx playwright test tests/e2e/pptx-import-fidelity.spec.js
npm run build
```

## Next Steps
- Execute with:
  `/ck:cook D:\NCKH_2025\Para_WorkSpace\NavSlidesEditor\Projects\NavSlidesEditor\repo\plans\260426-2128-pptx-import-coordinate-fidelity-hardening\plan.md`

## Unresolved Questions
- Does the failing real deck contain proprietary data? If yes, keep it local and
  add generated fixtures to git.
- Should imported crop become existing `imageW/imageH/imageOffset*` fields or
  should renderer consume `cropData` directly?
