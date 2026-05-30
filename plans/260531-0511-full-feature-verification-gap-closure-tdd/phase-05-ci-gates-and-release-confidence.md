# Phase 05 - CI Gates and Release Confidence

## Context Links

- [Plan](./plan.md)
- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [GitHub workflows](../../.github/workflows)

## Overview

Priority: P1. Status: Pending. Turn verification into repeatable gates that give clear release confidence without making every PR painfully slow.

## Key Insights

- PR lane should be fast and reliable.
- Merge/release lane can run heavier E2E, visual, PPTX, k6.
- Gate output must explain gaps, not just fail.

## Requirements

- Define PR fast lane and release full lane.
- Keep `matrix:gate` part of CI.
- Document which commands are local vs CI-only.
- No branch protection changes without explicit operator action.

## Architecture

Lane model:

```text
PR fast: lint + unit + matrix gate + selected E2E smoke
Merge full: full E2E + visual + coverage summary
Release strict: PPTX strict + Electron smoke + k6 smoke + manual checklist signoff
```

## Related Code Files

- Modify: `.github/workflows/*.yml`
- Modify: `package.json` scripts only if command grouping is needed
- Modify: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`
- Create: `plans/260531-0511-full-feature-verification-gap-closure-tdd/reports/ci-gate-verification.md`

## Implementation Steps

1. Red: add workflow/unit contract test for required scripts or workflow jobs.
2. Green: wire lane commands.
3. Ensure matrix gate fails new unallowlisted gaps.
4. Add local command checklist.
5. Verify with `npm test`, targeted E2E, and workflow contract tests.
6. Record results in CI gate report.

## Todo List

- [ ] Define PR fast lane command set.
- [ ] Define merge full lane command set.
- [ ] Define release strict lane command set.
- [ ] Add/adjust workflow contract tests.
- [ ] Document operator-only branch protection steps.

## Success Criteria

- CI tells exactly which verification layer failed.
- Fast lane remains practical for PRs.
- Release lane includes heavy checks without hiding failures.

## Risk Assessment

- Risk: CI time grows too much. Mitigation: shard E2E and reserve heavy checks for merge/release.
- Risk: flaky tests block work. Mitigation: fix flake or quarantine with dated issue, not silent skip.

## Security Considerations

- No secrets in workflows or logs.
- Release gates must not run destructive calls against non-loopback URLs.

## Next Steps

Phase 6 converts this into maintainable docs/process.
