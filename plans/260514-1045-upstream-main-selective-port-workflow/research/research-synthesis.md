# Research Synthesis

## Sources

- [Git strategy report](../../reports/researcher-260514-1045-upstream-main-selective-port-workflow.md)
- [Codebase impact report](../../reports/researcher-260514-upstream-selective-port-impact.md)
- [Previous validation report](../260514-0749-upstream-main-merge-sync/reports/validation-report.md)
- [Previous red-team report](../260514-0749-upstream-main-merge-sync/reports/red-team-review.md)

## Findings

- Full merge is blocked by unrelated histories. `--allow-unrelated-histories` would create an unreviewable repo-scale integration.
- Git-safe approach: backup ref, isolated worktree, topic branches, cherry-pick/manual port, revert-based rollback.
- Code-fit ranking:
  - Direct fit: `93816b88` Copy URL context menu.
  - Conditional fit: typography/export consistency commits around LaTeX/font controls.
  - Verify first: HTML embed present-mode commits because local implementation already differs.
  - Defer: timeline series and image citation/crop because local schema/UI surface lacks matching feature.

## Test Strategy

- Run baseline before porting to know current failures.
- Per topic: run focused unit/E2E for touched domain before broad suite.
- Final: `npm run lint`, `npm run build`, `npm run test`, targeted E2E, optional corpus if typography/export/import changes.

## Decision

Proceed with selective port plan. Do not continue the original full upstream merge plan.

## Unresolved Questions

- HTML embed defect needs reproduction before code change.
- Timeline/citation roadmap requires product decision, not merge hygiene.
